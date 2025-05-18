terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31.0"
    }
  }
  
  # Uncomment this block once you have a backend set up
  # backend "s3" {
  #   bucket         = "listen-fair-play-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "listen-fair-play-terraform-locks"
  #   encrypt        = true
  # }

  required_version = ">= 1.0.0"
}

provider "aws" {
  region = var.aws_region
  
  # Comment out or remove the profile setting if using environment variables
  # profile = var.aws_profile
  
  default_tags {
    tags = {
      Project     = "listen-fair-play"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# S3 bucket for storing podcast files and hosting website
module "s3_bucket" {
  source = "./modules/s3"
  
  bucket_name          = var.s3_bucket_name
  environment          = var.environment
  cors_allowed_origins = ["*"]  # Adjust as needed
}

# CloudFront distribution
module "cloudfront" {
  source = "./modules/cloudfront"
  
  bucket_name               = module.s3_bucket.bucket_name
  bucket_regional_domain_name = module.s3_bucket.bucket_regional_domain_name
  environment               = var.environment
}

# Wait for the S3 bucket to be fully configured
resource "time_sleep" "wait_for_bucket_configuration" {
  depends_on = [module.s3_bucket]
  create_duration = "10s"
}

# Update S3 bucket policy with CloudFront distribution ARN
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = module.s3_bucket.bucket_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action    = "s3:GetObject"
        Resource  = "${module.s3_bucket.bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = module.cloudfront.cloudfront_arn
          }
        }
      }
    ]
  })
  depends_on = [module.cloudfront, time_sleep.wait_for_bucket_configuration]
}

# Lambda for RSS feed processing
module "rss_lambda" {
  source = "./modules/lambda"
  
  function_name        = "retrieve-rss-feeds-and-download-audio-files"
  handler              = "retrieve-rss-feeds-and-download-audio-files.handler"
  runtime              = "nodejs20.x"
  timeout              = 300
  memory_size          = 2560
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
    LOG_LEVEL          = var.log_level
  }
  source_dir           = "../packages/ingestion/rss-retrieval-lambda/aws-dist"
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
  lambda_architecture  = ["arm64"]
}

# Lambda for Whisper transcription
module "whisper_lambda" {
  source = "./modules/lambda"
  
  function_name        = "process-new-audio-files-via-whisper"
  handler              = "process-new-audio-files-via-whisper.handler"
  runtime              = "nodejs20.x"
  timeout              = 900
  memory_size          = 1024
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
    OPENAI_API_KEY     = var.openai_api_key
    LOG_LEVEL          = var.log_level
  }
  source_dir           = "../packages/ingestion/process-audio-lambda/aws-dist"
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
  lambda_architecture  = ["arm64"]
}

# EventBridge schedule for daily RSS processing
module "eventbridge_schedule" {
  source = "./modules/eventbridge"
  
  schedule_name        = "daily-rss-processing"
  schedule_expression  = "cron(0 0 * * ? *)"  # Run at midnight UTC daily
  lambda_function_arn  = module.rss_lambda.lambda_function_arn
  environment          = var.environment
}

# IAM permissions to allow Lambda 1 to trigger Lambda 2
resource "aws_lambda_permission" "allow_lambda1_to_invoke_lambda2" {
  statement_id  = "AllowExecutionFromLambda1"
  action        = "lambda:InvokeFunction"
  function_name = module.whisper_lambda.lambda_function_name
  principal     = "lambda.amazonaws.com"
  source_arn    = module.rss_lambda.lambda_function_arn
}

# Lambda Layer for SQLite3
resource "aws_lambda_layer_version" "sqlite3_layer" {
  layer_name          = "sqlite3-layer-${var.environment}"
  description         = "sqlite3 npm package - layer for Lambda functions"
  filename           = "${path.module}/lambda-layers/sqlite3-layer.zip"
  compatible_runtimes = ["nodejs20.x"]
}

# Lambda for SRT to Search Entries conversion
module "indexing_lambda" {
  source = "./modules/lambda"

  function_name        = "convert-srt-files-into-indexed-search-entries"
  handler              = "convert-srt-files-into-indexed-search-entries.handler"
  runtime              = "nodejs20.x"
  timeout              = 600 # See PROCESSING_TIME_LIMIT_MINUTES in convert-srt-files-into-indexed-search-entries.ts
  memory_size          = 2048 
  ephemeral_storage    = 2048 # Trying to have enough space for the sqlite3 DB
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
    LOG_LEVEL          = var.log_level
  }
  source_dir           = "../packages/ingestion/srt-indexing-lambda/aws-dist"
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
  lambda_architecture  = ["arm64"]
  layers              = [aws_lambda_layer_version.sqlite3_layer.arn]
}

# IAM permissions to allow Lambda 2 (Whisper) to trigger Lambda 3 (Indexing)
resource "aws_lambda_permission" "allow_lambda2_to_invoke_lambda3" {
  statement_id  = "AllowExecutionFromLambda2"
  action        = "lambda:InvokeFunction"
  function_name = module.indexing_lambda.lambda_function_name
  principal     = "lambda.amazonaws.com"
  source_arn    = module.whisper_lambda.lambda_function_arn
}

# Lambda for Search
module "search_lambda" {
  source = "./modules/lambda"

  function_name        = "search-indexed-transcripts"
  handler              = "search-indexed-transcripts.handler" # As per search/README.md
  runtime              = "nodejs20.x"
  timeout              = 45 # While we hope all warm requests are < 500ms, we need sufficient time for cold starts, to load the SQLite DB file
  memory_size          = 3008 # Trying to allow the search to be performed as quickly as possible (3008 is current max)
  ephemeral_storage    = 2048 # Trying to have enough space for the sqlite3 DB
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
    LOG_LEVEL          = var.log_level
  }
  source_dir           = "../packages/search/search-lambda/aws-dist"
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
  lambda_architecture  = ["arm64"]
}

# API Gateway for Search Lambda
resource "aws_apigatewayv2_api" "search_api" {
  name          = "search-transcripts-api-${var.environment}"
  protocol_type = "HTTP"
  target        = module.search_lambda.lambda_function_arn
}

resource "aws_apigatewayv2_stage" "search_api_stage" {
  api_id      = aws_apigatewayv2_api.search_api.id
  name        = var.environment
  auto_deploy = true
}

# Implicit integration is created by setting `target` in aws_apigatewayv2_api for simple Lambda proxy.
# For more complex routing or request/response transformations, explicit aws_apigatewayv2_integration and aws_apigatewayv2_route would be needed.

# IAM permission for API Gateway to invoke Search Lambda
resource "aws_lambda_permission" "allow_apigw_to_invoke_search_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.search_lambda.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  # The source_arn should be specific to the API Gateway execution ARN for the route and stage
  source_arn = "${aws_apigatewayv2_api.search_api.execution_arn}/${var.environment}/*"
}

# --- S3 Bucket for Terraform State ---

resource "aws_s3_bucket" "terraform_state" {
  bucket = "listen-fair-play-terraform-state-${var.environment}" # Ensuring unique bucket name per environment

  tags = {
    Name        = "Terraform State Storage"
    Environment = var.environment
    Project     = "Listen Fair Play"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_encryption" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_public_access_block" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# It's generally better to manage permissions via IAM roles/policies attached to the entity (user/role)
# performing the Terraform operations, rather than a bucket policy.
# However, if a bucket policy is strictly needed, here's an example.
# Replace AWS_ACCOUNT_ID and IAM_USER_OR_ROLE_NAME with actual values.
# This part might need adjustment based on how your AWS CLI is authenticated (IAM user vs. IAM role).
# For SSO, the role name is usually something like "AWSReservedSSO_YourPermissionSet_RandomString"

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_policy" "terraform_state_bucket_policy" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" # Restrict further if possible
        },
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject" # For state locking and deletion
        ],
        Resource = [
          "${aws_s3_bucket.terraform_state.arn}/terraform.tfstate",
          "${aws_s3_bucket.terraform_state.arn}/terraform.tfstate-lock" # If using state locking
        ]
      },
      {
        Effect = "Allow",
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" # Restrict further if possible
        },
        Action = "s3:ListBucket",
        Resource = aws_s3_bucket.terraform_state.arn,
        Condition = {
          StringLike = {
            "s3:prefix" = ["terraform.tfstate-lock*", "terraform.tfstate"]
          }
        }
      }
    ]
  })
} 