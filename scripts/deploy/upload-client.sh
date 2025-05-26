#!/bin/bash

set -e

# Default environment is dev
ENV=${1:-dev}

# Source environment variables
if [ -f ".env.$ENV" ]; then
  echo "Loading environment variables from .env.$ENV"
  source ".env.$ENV"
else
  echo "Error: .env.$ENV file not found"
  exit 1
fi

# Validate AWS profile
if [ -z "$AWS_PROFILE" ]; then
  echo "Error: AWS_PROFILE is not set in .env.$ENV"
  exit 1
fi

# Check if AWS SSO session is active
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
  echo "AWS SSO session is not active or has expired for profile $AWS_PROFILE"
  echo "Please run: aws sso login --profile $AWS_PROFILE"
  exit 1
fi

# Get the S3 bucket name and CloudFront domain from Terraform output
cd "$(dirname "$0")/../../terraform"
BUCKET_NAME=$(terraform output -raw s3_bucket_name)
CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_distribution_domain_name)
CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)
SEARCH_API_URL=$(terraform output -raw search_api_invoke_url)

# S3 files are hosted at the same domain as the client
# (note: locally, this is a local server, handled in App.tsx)
S3_HOSTED_FILES_BASE_URL="/"

# Go back to the project root
cd ..

echo "Building client with search API URL: $SEARCH_API_URL"
echo "Building client with manifest base URL: $S3_HOSTED_FILES_BASE_URL"
cd packages/client
export VITE_SEARCH_API_URL="$SEARCH_API_URL"
export VITE_S3_HOSTED_FILES_BASE_URL="$S3_HOSTED_FILES_BASE_URL"
pnpm build-client:$ENV
cd ../..

echo "Uploading client files to S3 bucket: $BUCKET_NAME"
echo "CloudFront domain: $CLOUDFRONT_DOMAIN"

# Check if source files exist
if [ ! -f "packages/client/dist/index.html" ]; then
  echo "Error: packages/client/dist/index.html not found"
  exit 1
fi

if [ ! -d "packages/client/dist/assets" ]; then
  echo "Error: packages/client/dist/assets directory not found"
  exit 1
fi

# Upload index.html to root
echo "Uploading index.html..."
aws s3 cp packages/client/dist/index.html s3://$BUCKET_NAME/index.html --profile "$AWS_PROFILE"

# Upload assets directory (this will delete old assets but preserve other bucket contents)
echo "Uploading assets directory..."
aws s3 sync packages/client/dist/assets/ s3://$BUCKET_NAME/assets/ --delete --profile "$AWS_PROFILE"

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*" \
  --profile "$AWS_PROFILE" \
  --no-cli-pager

echo "Upload complete. Your site should be available at:"
echo "https://$CLOUDFRONT_DOMAIN" 