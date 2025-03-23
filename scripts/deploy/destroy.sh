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
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: Required environment variables are missing."
  echo "Make sure .env.local contains:"
  echo "  AWS_ACCESS_KEY_ID=your_aws_access_key"
  echo "  AWS_SECRET_ACCESS_KEY=your_aws_secret_key"
  echo "  AWS_REGION=your_aws_region (default: us-east-1)"
  echo "  OPENAI_API_KEY=your_openai_api_key"
  exit 1
fi

# Set AWS region if not already set
export AWS_REGION=${AWS_REGION:-us-east-1}

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

# Destroy the infrastructure
terraform destroy \
  -var-file=environments/$ENV.tfvars \
  -var="openai_api_key=$OPENAI_API_KEY" \
  -auto-approve

echo "======= Destruction Complete =======" 