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

## Environment Strategy

To minimize costs and match expected usage patterns:
- **Production (`prod`)**: The main environment that runs continuously
- **Development (`dev`)**: Temporary environment for testing changes before deploying to production

## Directory Structure

- `/terraform`: Main Terraform configuration
  - `/modules`: Reusable Terraform modules
    - `/s3`: S3 bucket configuration
    - `/cloudfront`: CloudFront distribution
    - `/lambda`: Lambda function setup
    - `/eventbridge`: EventBridge scheduler
  - `/environments`: Environment-specific variable files
    - `dev.tfvars`: Development environment variables
    - `prod.tfvars`: Production environment variables

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

2. Plan the deployment for development:
   ```
   terraform plan -var-file=environments/dev.tfvars -var="openai_api_key=sk-your-api-key"
   ```

3. Apply the configuration for development:
   ```
   terraform apply -var-file=environments/dev.tfvars -var="openai_api_key=sk-your-api-key"
   ```

4. For production deployment:
   ```
   terraform apply -var-file=environments/prod.tfvars -var="openai_api_key=sk-your-api-key"
   ```

5. To destroy a development environment when no longer needed:
   ```
   terraform destroy -var-file=environments/dev.tfvars -var="openai_api_key=sk-your-api-key"
   ```

## Important Notes

- The OpenAI API key should be provided securely, preferably through environment variables or AWS Secrets Manager in production
- For production use, consider setting up a remote backend for Terraform state (uncomment the backend configuration in main.tf)
- Update the S3 bucket name to ensure global uniqueness
- The development environment can be destroyed when not in use to minimize costs

## Outputs

After successful deployment, Terraform will output:
- S3 bucket name
- CloudFront domain name
- Lambda function names 