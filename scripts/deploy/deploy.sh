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

# Set profile flag if using AWS profile
PROFILE_FLAG=""
if [ -n "$AWS_PROFILE" ]; then
  PROFILE_FLAG="-var=aws_profile=$AWS_PROFILE"
fi

# Plan the deployment
terraform plan \
  -var-file=environments/$ENV.tfvars \
  -var="openai_api_key=$OPENAI_API_KEY" \
  $PROFILE_FLAG \
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