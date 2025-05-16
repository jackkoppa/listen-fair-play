#!/bin/bash

set -e

# Default environment is dev
ENV=${1:-dev}

# Terraform configuration
TF_DIR="terraform"
TF_STATE_FILENAME="terraform.tfstate" # Basename of the state file, e.g., terraform.tfstate
TF_STATE_BUCKET="listen-fair-play-terraform-state-$ENV"

# Variables to be exported for use by manage-tfstate.sh
export TF_STATE_FILENAME
export S3_TFSTATE_URI="s3://$TF_STATE_BUCKET/$TF_STATE_FILENAME"
# AWS_PROFILE will be exported later if it's set

# Run prerequisite check
./scripts/deploy/check-prerequisites.sh
if [ $? -ne 0 ]; then
  echo "Prerequisite check failed. Please address the issues above before deploying."
  exit 1
fi

# Check if .env.dev exists and source it
if [ -f ".env.dev" ]; then
  echo "Loading environment variables from .env.dev"
  source .env.dev
else
  echo "Warning: .env.dev file not found. Make sure to create it with necessary credentials."
fi

# Validate required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OpenAI API key is missing."
  echo "Make sure .env.dev contains:"
  echo "  OPENAI_API_KEY=your_openai_api_key"
  exit 1
fi

# Set AWS region if not already set
export AWS_REGION=${AWS_REGION:-us-east-1}

# Set AWS profile if specified and export it for sourced scripts
if [ -n "$AWS_PROFILE" ]; then
  echo "Using AWS SSO profile: $AWS_PROFILE"
  export AWS_PROFILE # Export for manage-tfstate.sh and aws cli
  
  # Check if SSO session is active
  if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "AWS SSO session is not active or has expired for profile $AWS_PROFILE"
    echo "Please run: aws sso login --profile $AWS_PROFILE"
    exit 1
  fi
fi

# Source the Terraform state management script
# Ensure it's executable, though sourcing doesn't strictly require it.
chmod +x ./scripts/deploy/manage-tfstate.sh
source ./scripts/deploy/manage-tfstate.sh

echo "Building all packages for $ENV environment..."
pnpm install
# Build shared packages
pnpm all:build
# Build /packages/processing lambdas, /packages/search lambdas, and /packages/client UI app
pnpm all:build:$ENV

# --- Terraform Deployment ---
echo "Navigating to Terraform directory: $TF_DIR"
cd "$TF_DIR"

# --- Terraform State Sync ---
# This function is from manage-tfstate.sh and assumes CWD is the Terraform directory.
compare_tf_states

# Initialize Terraform (if needed)
echo "Initializing Terraform..."
terraform init

# Validate Terraform configuration
echo "Validating Terraform configuration..."
terraform validate

# Set profile flag for Terraform commands if using AWS profile
TERRAFORM_PROFILE_FLAG=""
if [ -n "$AWS_PROFILE" ]; then
  TERRAFORM_PROFILE_FLAG="-var=aws_profile=$AWS_PROFILE"
fi

# Plan the deployment
terraform plan \
  -var-file=environments/$ENV.tfvars \
  -var="openai_api_key=$OPENAI_API_KEY" \
  -var="log_level=$LOG_LEVEL" \
  $TERRAFORM_PROFILE_FLAG \
  -out=tfplan

# Ask for confirmation before applying
read -p "Do you want to apply this Terraform plan? (y/N): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
  echo "Applying Terraform plan..."
  terraform apply -auto-approve tfplan
  
  echo "Terraform apply completed."
  # Upload state backup. This function is from manage-tfstate.sh.
  upload_tf_state_backup

  # Display outputs
  echo "======= Deployment Complete ======="
  terraform output
else
  echo "Deployment cancelled."
  # If deployment is cancelled, no state change, so no need to upload state.
fi

# Return to the original directory
cd ..
echo "Returned to $(pwd)" 