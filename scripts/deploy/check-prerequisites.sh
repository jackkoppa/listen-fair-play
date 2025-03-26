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

# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    source .env.local
fi

# Check AWS SSO authentication
if [ -n "$AWS_PROFILE" ]; then
    # Test SSO authentication with the specified profile
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
        echo "❌ AWS SSO credentials are not working or expired."
        echo "  Please run 'aws sso login --profile $AWS_PROFILE' to authenticate"
        exit 1
    else
        echo "✅ AWS SSO authentication verified with profile: $AWS_PROFILE"
    fi
else
    echo "❌ AWS_PROFILE is not set in .env.local"
    echo "  Please add AWS_PROFILE to .env.local for AWS SSO authentication"
    echo "  Run 'aws configure sso' to set up an SSO profile if needed"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20 or later"
    exit 1
else
    NODE_VERSION=$(node --version | cut -d 'v' -f 2)
    echo "✅ Node.js v$NODE_VERSION installed"
    
    # Check Node.js version
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo "⚠️  Warning: Node.js version 20 or later is recommended (current: $NODE_VERSION)"
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
    
    # Check for AWS profile
    if ! grep -q "AWS_PROFILE" .env.local; then
        echo "⚠️  Warning: AWS_PROFILE not found in .env.local"
    fi
fi

echo "✅ All prerequisites checked! You're ready to deploy." 