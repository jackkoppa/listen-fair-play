#!/bin/bash

# Script to upload client files to S3

# Get the S3 bucket name from Terraform output
cd "$(dirname "$0")/../terraform"
BUCKET_NAME=$(terraform output -raw s3_bucket_name)
CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_distribution_domain_name)

echo "Uploading client files to S3 bucket: $BUCKET_NAME"
echo "CloudFront domain: $CLOUDFRONT_DOMAIN"

# Go back to the project root
cd ..

# Upload client files to S3
aws s3 sync client/dist/ s3://$BUCKET_NAME/ --delete

echo "Upload complete. Your site should be available at:"
echo "https://$CLOUDFRONT_DOMAIN" 