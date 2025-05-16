variable "aws_region" {
  description = "The AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "The AWS profile to use for authentication (for SSO)"
  type        = string
  default     = null
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
  default     = ""
}

variable "log_level" {
  description = "log level (trace, debug, info, warn, or error)"
  type        = string
  sensitive   = true
  default     = ""
}