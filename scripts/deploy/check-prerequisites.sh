#!/bin/bash

set -e

echo "Checking prerequisites for Listen Fair Play deployment..."

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install it from https://developer.hashicorp.com/terraform/install"
    exit 1
else
    TERRAFORM_VERSION=$(terraform --version | head -n 1 | cut -d ' ' -f 2 | cut -d 'v' -f 2)
    echo "✅ Terraform v$TERRAFORM_VERSION installed"
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
else
    AWS_VERSION=$(aws --version | cut -d ' ' -f 1 | cut -d '/' -f 2)
    echo "✅ AWS CLI v$AWS_VERSION installed"
fi

# Check if AWS credentials are configured
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    if ! aws sts get-caller-identity &> /dev/null; then
        echo "❌ AWS credentials are not properly configured."
        echo "  Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local"
        echo "  or configure the AWS CLI using 'aws configure'"
        exit 1
    fi
else
    echo "✅ AWS credentials detected"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 22 or later"
    exit 1
else
    NODE_VERSION=$(node --version | cut -d 'v' -f 2)
    echo "✅ Node.js v$NODE_VERSION installed"
    
    # Check Node.js version
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo "⚠️  Warning: Node.js version 22 or later is recommended (current: $NODE_VERSION)"
    fi
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm 8 or later using 'npm install -g pnpm@8'"
    exit 1
else
    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm v$PNPM_VERSION installed"
    
    # Check pnpm version
    PNPM_MAJOR=$(echo $PNPM_VERSION | cut -d '.' -f 1)
    if [ "$PNPM_MAJOR" -lt 8 ]; then
        echo "⚠️  Warning: pnpm version 8 or later is recommended (current: $PNPM_VERSION)"
    fi
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Please create it from .env.local.example"
    exit 1
else
    echo "✅ .env.local file exists"
    
    # Check for required variables in .env.local
    if ! grep -q "OPENAI_API_KEY" .env.local; then
        echo "⚠️  Warning: OPENAI_API_KEY not found in .env.local"
    fi
fi

echo "✅ All prerequisites checked! You're ready to deploy." 