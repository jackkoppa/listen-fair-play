variable "aws_region" {
  description = "The AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "The environment name (dev or prod)"
  type        = string
  default     = "dev"
}

variable "s3_bucket_name" {
  description = "The name of the S3 bucket for storing podcast files and hosting the website"
  type        = string
  default     = "listen-fair-play-s3-bucket"
}

variable "openai_api_key" {
  description = "OpenAI API key for Whisper transcription"
  type        = string
  sensitive   = true
} 