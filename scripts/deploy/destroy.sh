#!/bin/bash

set -e

# Default environment is dev
ENV=${1:-dev}

# Run prerequisite check
./scripts/deploy/check-prerequisites.sh
if [ $? -ne 0 ]; then
  echo "Prerequisite check failed. Please address the issues above before destroying."
  exit 1
fi

# Check if .env.local exists and source it
if [ -f ".env.local" ]; then
  echo "Loading environment variables from .env.local"
  source .env.local
else
  echo "Warning: .env.local file not found. Make sure to create it with necessary credentials."
  exit 1
fi

# Validate required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OpenAI API key is missing."
  echo "Make sure .env.local contains:"
  echo "  OPENAI_API_KEY=your_openai_api_key"
  exit 1
fi

# Set AWS region if not already set
export AWS_REGION=${AWS_REGION:-us-east-1}

# Set AWS profile if specified
if [ -n "$AWS_PROFILE" ]; then
  echo "Using AWS SSO profile: $AWS_PROFILE"
  export AWS_PROFILE=$AWS_PROFILE
  
  # Check if SSO session is active
  if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "AWS SSO session is not active or has expired"
    echo "Please run: aws sso login --profile $AWS_PROFILE"
    exit 1
  fi
fi

# Warn if trying to destroy production
if [ "$ENV" == "prod" ]; then
  echo "WARNING: You are about to destroy the PRODUCTION environment!"
  read -p "Type 'destroy-prod' to confirm: " confirmation
  if [ "$confirmation" != "destroy-prod" ]; then
    echo "Destruction cancelled."
    exit 1
  fi
fi

# Run Terraform destroy
echo "Destroying $ENV environment..."
cd terraform

# Initialize Terraform (if needed)
terraform init

# Set profile flag if using AWS profile
PROFILE_FLAG=""
if [ -n "$AWS_PROFILE" ]; then
  PROFILE_FLAG="-var=aws_profile=$AWS_PROFILE"
fi

# Destroy the infrastructure
terraform destroy \
  -var-file=environments/$ENV.tfvars \
  -var="openai_api_key=$OPENAI_API_KEY" \
  -var="log_level=$LOG_LEVEL" \
  $PROFILE_FLAG \
  -auto-approve

echo "======= Destruction Complete =======" 