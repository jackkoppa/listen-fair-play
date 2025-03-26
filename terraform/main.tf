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
  region  = var.aws_region
  profile = var.aws_profile
  
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
  
  bucket_name       = var.s3_bucket_name
  environment       = var.environment
  cors_allowed_origins = ["*"]  # Adjust as needed
}

# CloudFront distribution
module "cloudfront" {
  source = "./modules/cloudfront"
  
  bucket_name               = module.s3_bucket.bucket_name
  bucket_regional_domain_name = module.s3_bucket.bucket_regional_domain_name
  environment               = var.environment
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