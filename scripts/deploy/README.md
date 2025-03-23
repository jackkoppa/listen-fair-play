# Listen Fair Play - Local Deployment

This directory contains scripts for local deployment of the Listen Fair Play application to AWS using Terraform.

## Prerequisites

1. **Terraform** - Install Terraform
   ```bash
   # For macOS with Homebrew
   brew install terraform

   # For other platforms, see https://developer.hashicorp.com/terraform/install
   ```

2. **AWS CLI** - Install and configure AWS CLI
   ```bash
   # For macOS with Homebrew
   brew install awscli
   
   # For other platforms, see https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
   ```

3. **Node.js** - Make sure you have Node.js 22 or later installed
   ```bash
   # Using nvm (recommended)
   nvm install 22
   nvm use 22
   ```

4. **pnpm** - For managing Node.js dependencies
   ```bash 
   npm install -g pnpm@8
   ```

## Configuration

1. Create a `.env.local` file in the project root with your AWS and OpenAI credentials:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and fill in your credentials:
   ```
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=us-east-1
   OPENAI_API_KEY=your_openai_api_key
   ```

3. AWS IAM User Requirements:
   - Your AWS user needs permissions for:
     - Lambda management
     - S3 bucket creation/management
     - CloudFront distribution management
     - EventBridge scheduler management
     - IAM role creation for Lambda functions

## Deployment

### Deploy to Development Environment

```bash
./scripts/deploy/deploy.sh dev
```

### Deploy to Production Environment

```bash
./scripts/deploy/deploy.sh prod
```

### Destroy an Environment

Be careful when destroying environments, as this will delete all resources created by Terraform!

```bash
# Destroy development environment
./scripts/deploy/destroy.sh dev

# Destroy production environment (requires confirmation)
./scripts/deploy/destroy.sh prod
```

## What the Deployment Does

The deployment process:

1. Builds the Lambda functions in the `processing` directory
2. Builds the React application in the `client` directory
3. Initializes Terraform and validates the configuration
4. Plans the deployment based on the specified environment
5. After confirmation, applies the Terraform plan
6. Displays outputs such as the CloudFront URL for accessing the application

## Troubleshooting

### Permission Issues

If you encounter permission issues, verify that your AWS user has the necessary permissions listed above.

### Terraform State Issues

By default, the Terraform state is stored locally. If multiple people need to deploy, consider:
1. Setting up a remote backend with S3 and DynamoDB (edit `terraform/main.tf`)
2. Sharing the state securely

### Resource Name Conflicts

If you get errors about resource names already existing:
1. Check if you already have resources with the same names
2. Edit the variable files in `terraform/environments/` to use unique names

### AWS Region Considerations

The default AWS region is `us-east-1`. If you need to use a different region:
1. Set the `AWS_REGION` in your `.env.local` file
2. Update any region-specific configurations in Terraform variables 