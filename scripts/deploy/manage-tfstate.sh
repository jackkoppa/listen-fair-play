#!/bin/bash
# This script provides functions to manage Terraform state backup in S3.
# It expects to be sourced by another script that sets up the following environment variables:
# - S3_TFSTATE_URI: The full S3 URI for the Terraform state file (e.g., s3://my-bucket/environment/terraform.tfstate)
# - TF_STATE_FILENAME: The basename of the Terraform state file (e.g., terraform.tfstate)
# - AWS_PROFILE: (Optional) The AWS profile to use for AWS CLI commands.
#
# All functions in this script assume they are executed from WITHIN the Terraform configuration directory.

# Define a local temporary filename for the S3 state download.
# This is derived from TF_STATE_FILENAME passed from the parent script.
_TF_STATE_DOWNLOAD_TEMP_NAME="${TF_STATE_FILENAME}.s3"

# Internal helper function for AWS CLI S3 commands.
# It respects the AWS_PROFILE environment variable if set.
_run_aws_s3_cmd() {
  local s3_args=("$@")
  if [ -n "$AWS_PROFILE" ]; then
    aws s3 "${s3_args[@]}" --profile "$AWS_PROFILE"
  else
    aws s3 "${s3_args[@]}"
  fi
}

# Compares local Terraform state with the backup in S3 and prompts for synchronization.
compare_tf_states() {
  echo "Checking Terraform state backup in S3: $S3_TFSTATE_URI..."

  # Attempt to download the S3 state backup to a temporary file.
  if _run_aws_s3_cmd cp "$S3_TFSTATE_URI" "$_TF_STATE_DOWNLOAD_TEMP_NAME" --quiet; then
    echo "Successfully downloaded S3 state backup to $_TF_STATE_DOWNLOAD_TEMP_NAME for comparison."

    if [ ! -f "$TF_STATE_FILENAME" ]; then # Check if local state file exists
      echo "Local state file $TF_STATE_FILENAME does not exist in $(pwd)."
      read -p "Do you want to use the S3 state backup as your local state? (y/N): " confirm_s3_restore
      if [[ $confirm_s3_restore == [yY] || $confirm_s3_restore == [yY][eE][sS] ]]; then
        cp "$_TF_STATE_DOWNLOAD_TEMP_NAME" "$TF_STATE_FILENAME"
        echo "Restored S3 state backup to $TF_STATE_FILENAME."
      else
        echo "Proceeding without local state. A new state file may be created by Terraform if it doesn't exist."
      fi
    else # Local state file exists, so compare it with the downloaded S3 version.
      if diff "$TF_STATE_FILENAME" "$_TF_STATE_DOWNLOAD_TEMP_NAME" >/dev/null; then
        echo "Local Terraform state ($TF_STATE_FILENAME) and S3 backup are identical."
      else
        echo "WARNING: Local Terraform state ($TF_STATE_FILENAME) and S3 backup ($_TF_STATE_DOWNLOAD_TEMP_NAME) have diverged!"
        echo "Differences (local state vs S3 backup):"
        diff -u "$TF_STATE_FILENAME" "$_TF_STATE_DOWNLOAD_TEMP_NAME" || true # Show diff, ignore diff's exit code
        echo ""
        read -p "Choose an action: (L)oad S3 backup to local, (C)ontinue with local (S3 backup will be overwritten), or (A)bort: " state_conflict_action
        case "$state_conflict_action" in
          [Ll])
            cp "$_TF_STATE_DOWNLOAD_TEMP_NAME" "$TF_STATE_FILENAME"
            echo "S3 state backup has been loaded to local $TF_STATE_FILENAME."
            echo "The S3 backup will be updated with this state if deployment is successful."
            ;;
          [Cc])
            echo "Continuing with local state $TF_STATE_FILENAME."
            echo "S3 backup will be overwritten with the local state if deployment is successful."
            ;;
          [Aa]|*)
            echo "Aborting deployment due to state conflict. Please resolve manually."
            # Clean up the temporary downloaded S3 state file before exiting.
            if [ -f "$_TF_STATE_DOWNLOAD_TEMP_NAME" ]; then
              rm "$_TF_STATE_DOWNLOAD_TEMP_NAME"
            fi
            exit 1
            ;;
        esac
      fi
    fi
    # Clean up the temporary downloaded S3 state file if it still exists.
    if [ -f "$_TF_STATE_DOWNLOAD_TEMP_NAME" ]; then
       rm "$_TF_STATE_DOWNLOAD_TEMP_NAME"
    fi
  else
    echo "⚠️ Could not download Terraform state backup from $S3_TFSTATE_URI."
    echo "    This could be the first deployment for this environment, or the S3 object may not exist yet."
    if [ ! -f "$TF_STATE_FILENAME" ]; then
      echo "    ➡️ No local state file ($TF_STATE_FILENAME) found in $(pwd) either. Terraform will likely create a new state."
    else
      echo "    ➡️ Proceeding with existing local state file ($TF_STATE_FILENAME). This local state will be backed up to S3 if deployment is successful."
    fi
  fi
  echo "----------------------------------------"
}

# Uploads the local Terraform state file to the S3 backup location.
upload_tf_state_backup() {
  if [ ! -f "$TF_STATE_FILENAME" ]; then
    echo "ERROR: Local Terraform state file ($TF_STATE_FILENAME) not found in $(pwd). Cannot upload to S3."
    return 1 # Indicate error
  fi

  echo "Uploading local Terraform state ($TF_STATE_FILENAME) from $(pwd) to S3 backup: $S3_TFSTATE_URI"
  if _run_aws_s3_cmd cp "$TF_STATE_FILENAME" "$S3_TFSTATE_URI"; then
    echo "Successfully uploaded $TF_STATE_FILENAME to $S3_TFSTATE_URI"
  else
    echo "ERROR: Failed to upload $TF_STATE_FILENAME to $S3_TFSTATE_URI"
    # Optionally, make this a fatal error by exiting: exit 1
  fi
} 