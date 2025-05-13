#!/bin/bash

# Script to trigger the retrieve-rss-feeds-and-download-audio-files Lambda function

# Configuration
LAMBDA_FUNCTION_NAME="YOUR_LAMBDA_FUNCTION_NAME" # <-- Replace with your actual Lambda function name
AWS_REGION="$(aws configure get region)" # Or set your region directly e.g., "us-east-1"
OUTPUT_FILE="lambda_invoke_output.json"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "AWS CLI could not be found. Please install and configure it."
    exit 1
fi

# Check if a function name is provided
if [ "$LAMBDA_FUNCTION_NAME" == "YOUR_LAMBDA_FUNCTION_NAME" ] || [ -z "$LAMBDA_FUNCTION_NAME" ]; then
    echo "Please replace YOUR_LAMBDA_FUNCTION_NAME in the script with your actual Lambda function name."
    exit 1
fi


echo "Attempting to invoke Lambda function: $LAMBDA_FUNCTION_NAME in region: $AWS_REGION..."

# Invoke the Lambda function
aws lambda invoke \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --cli-binary-format raw-in-base64-out \
    --payload '{}' \
    "$OUTPUT_FILE"

# Check the exit status of the AWS CLI command
if [ $? -eq 0 ]; then
    echo "Lambda function invoked successfully."
    echo "Output (and any errors from the Lambda execution) saved to: $OUTPUT_FILE"
    echo "Quick view of the output:"
    cat "$OUTPUT_FILE"
    echo ""
else
    echo "Lambda function invocation failed. Check the output above or in $OUTPUT_FILE for details."
    exit 1
fi

# Optional: Add command to make script executable: chmod +x scripts/trigger-retrieve-rss-lambda.sh 