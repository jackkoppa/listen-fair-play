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

See [/scripts/deploy/README.md](../scripts/deploy/README.md) for usage instructions.