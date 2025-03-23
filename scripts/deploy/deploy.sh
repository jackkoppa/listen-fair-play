#!/bin/bash

set -e

# Default environment is dev
ENV=${1:-dev}

# Run prerequisite check
./scripts/deploy/check-prerequisites.sh
if [ $? -ne 0 ]; then
  echo "Prerequisite check failed. Please address the issues above before deploying."
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

# Build Lambda functions
echo "Building Lambda functions..."
cd processing
pnpm install
pnpm build
cd ..

# Build client application
echo "Building client application..."
cd client
pnpm install
pnpm run build
cd ..

# Run Terraform deployment
echo "Deploying to $ENV environment using Terraform..."
cd terraform

# Initialize Terraform (if needed)
terraform init

# Validate Terraform configuration
terraform validate

# Plan the deployment
terraform plan \
  -var-file=environments/$ENV.tfvars \
  -var="openai_api_key=$OPENAI_API_KEY" \
  -out=tfplan

# Ask for confirmation before applying
read -p "Do you want to apply this Terraform plan? (y/N): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
  terraform apply -auto-approve tfplan
  
  # Display outputs
  echo "======= Deployment Complete ======="
  terraform output
else
  echo "Deployment cancelled."
fi 