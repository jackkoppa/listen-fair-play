# Listen Fair Play - Terraform Configuration

This directory contains the Terraform configuration for deploying the Listen Fair Play application to AWS.

## Architecture

The infrastructure consists of the following components:

1. **S3 Bucket**: Stores audio files, transcriptions, and hosts the static website
2. **CloudFront**: CDN for delivering content
3. **Lambda Functions**:
   - RSS feed retrieval and audio download
   - Whisper API transcription
4. **EventBridge Scheduler**: Triggers the RSS Lambda function daily

## Directory Structure

- `/terraform`: Main Terraform configuration
  - `/modules`: Reusable Terraform modules
    - `/s3`: S3 bucket configuration
    - `/cloudfront`: CloudFront distribution
    - `/lambda`: Lambda function setup
    - `/eventbridge`: EventBridge scheduler
  - `/environments`: Environment-specific variable files
    - `dev.tfvars`: Development environment variables

## Prerequisites

1. Install Terraform (version 1.0.0 or later)
2. Configure AWS CLI with appropriate credentials
3. Build the Lambda functions:
   ```
   cd ../processing
   pnpm build
   ```

## Usage

1. Initialize Terraform:
   ```
   cd terraform
   terraform init
   ```

2. Plan the deployment:
   ```
   terraform plan -var-file=environments/dev.tfvars -var="openai_api_key=sk-your-api-key"
   ```

3. Apply the configuration:
   ```
   terraform apply -var-file=environments/dev.tfvars -var="openai_api_key=sk-your-api-key"
   ```

## Important Notes

- The OpenAI API key should be provided securely, preferably through environment variables or AWS Secrets Manager in production
- For production use, consider setting up a remote backend for Terraform state (uncomment the backend configuration in main.tf)
- Update the S3 bucket name to ensure global uniqueness 

## Outputs

After successful deployment, Terraform will output:
- S3 bucket name
- CloudFront domain name
- Lambda function names 