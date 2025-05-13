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
  memory_size          = 512
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
  }
  source_dir           = "../processing/dist/lamdas"
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
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
  }
  source_dir           = "../processing/dist/lamdas"
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
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

# Lambda for SRT to Search Entries conversion
module "indexing_lambda" {
  source = "./modules/lambda"

  function_name        = "convert-srt-files-into-search-entries"
  handler              = "convert-srt-files-into-search-entries.handler"
  runtime              = "nodejs20.x"
  timeout              = 300 # Adjust as needed
  memory_size          = 512 # Adjust as needed
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
  }
  source_dir           = "../processing/dist/lamdas" # Assuming it's in the same dir as other processing lambdas
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
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
  timeout              = 60  # Adjust as needed
  memory_size          = 512 # Adjust as needed
  environment_variables = {
    S3_BUCKET_NAME     = module.s3_bucket.bucket_name
    # Add any other ENV VARS needed by the search lambda
  }
  source_dir           = "../search/dist/lambdas" # Assuming build output like processing lambdas
  s3_bucket_name       = module.s3_bucket.bucket_name
  environment          = var.environment
}

# API Gateway for Search Lambda
resource "aws_apigatewayv2_api" "search_api" {
  name          = "search-transcripts-api-${var.environment}"
  protocol_type = "HTTP"
  target        = module.search_lambda.lambda_function_arn
}

resource "aws_apigatewayv2_stage" "search_api_stage" {
  api_id      = aws_apigatewayv2_api.search_api.id
  name        = "$default" # Default stage
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

  # The source_arn should be specific to the API Gateway execution ARN for the route
  # Example: arn:aws:execute-api:us-east-1:123456789012:abcdef123/*/*
  # For HTTP APIs, a common approach is to allow any route on this API:
  source_arn = "${aws_apigatewayv2_api.search_api.execution_arn}/*/*"
} 