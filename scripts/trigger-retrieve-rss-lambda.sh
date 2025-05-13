#!/bin/bash

# Script to trigger the retrieve-rss-feeds-and-download-audio-files Lambda function

# Load environment variables from .env.dev if it exists
if [ -f ".env.dev" ]; then
    echo "Loading environment variables from .env.dev..."
    source .env.dev
else
    echo "Warning: .env.dev file not found. AWS_PROFILE might not be set."
fi

# Configuration
LAMBDA_FUNCTION_NAME="retrieve-rss-feeds-and-download-audio-files" # defined in /terraform/main.tf, "Lambda for RSS feed processing"
AWS_REGION="${AWS_REGION:-$(aws configure get region)}" # Use AWS_REGION from .env.dev if set, otherwise get from aws config
OUTPUT_FILE="lambda_invoke_output.json"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "❌ AWS CLI could not be found. Please install and configure it."
    exit 1
fi

# Check AWS SSO authentication
if [ -n "$AWS_PROFILE" ]; then
    echo "Attempting to use AWS Profile: $AWS_PROFILE"
    # Test SSO authentication with the specified profile
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
        echo "❌ AWS SSO credentials are not working or expired for profile: $AWS_PROFILE."
        echo "  Please run 'aws sso login --profile $AWS_PROFILE' to authenticate."
        exit 1
    else
        echo "✅ AWS SSO authentication verified with profile: $AWS_PROFILE"
    fi
else
    echo "❌ AWS_PROFILE is not set. Please ensure it's defined in your .env.dev file or environment."
    echo "  Example .env.dev entry: AWS_PROFILE=your_profile_name"
    echo "  If you haven't configured an SSO profile, run 'aws configure sso'."
    exit 1
fi


# Check if a function name is provided (should always be set by default now)
if [ "$LAMBDA_FUNCTION_NAME" == "YOUR_LAMBDA_FUNCTION_NAME" ] || [ -z "$LAMBDA_FUNCTION_NAME" ]; then
    echo "Error: LAMBDA_FUNCTION_NAME is not correctly set in the script." # Should not happen
    exit 1
fi


echo "Attempting to invoke Lambda function: $LAMBDA_FUNCTION_NAME in region: $AWS_REGION using profile: $AWS_PROFILE..."

# Invoke the Lambda function
aws lambda invoke \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --cli-binary-format raw-in-base64-out \
    --payload '{}' \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    "$OUTPUT_FILE"

# Check the exit status of the AWS CLI command
if [ $? -eq 0 ]; then
    echo "✅ Lambda function invoked successfully."
    echo "Output (and any errors from the Lambda execution) saved to: $OUTPUT_FILE"
    echo "---------------------------------------------------------------------"
    echo "Quick view of the output (from $OUTPUT_FILE):"
    cat "$OUTPUT_FILE"
    echo ""
    echo "---------------------------------------------------------------------"
    # Check for errors within the Lambda's response (output file)
    # AWS Lambda often returns a 200 OK HTTP status even if the function had an error.
    # The actual error is in the payload.
    if grep -q "errorMessage" "$OUTPUT_FILE"; then
        echo "⚠️  NOTE: The Lambda function was invoked, but its execution might have resulted in an error."
        echo "   Please check the contents of '$OUTPUT_FILE' for details like 'errorMessage' or 'errorType'."
    fi
else
    echo "❌ Lambda function invocation command failed."
    echo "   Check the AWS CLI error output above. If it mentions credentials, ensure your SSO session for profile '$AWS_PROFILE' is active."
    echo "   Output from the failed command (if any) is in $OUTPUT_FILE."
    exit 1
fi

# Reminder to make script executable: chmod +x scripts/trigger-retrieve-rss-lambda.sh 