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
  default     = "info"
}

variable "custom_domain_name" {
  description = "The custom domain name for the website (e.g., listenfairplay.com)"
  type        = string
  default     = ""
}

variable "root_domain_name" {
  description = "The root domain name (e.g., listenfairplay.com)"
  type        = string
  default     = ""
}

variable "enable_custom_domain_on_cloudfront" {
  description = "Whether to enable custom domain on CloudFront (set to false initially, then true after DNS validation)"
  type        = bool
  default     = false
}

variable "enable_search_lambda_warming" {
  description = "Whether to enable scheduled warming of the search lambda to reduce cold starts"
  type        = bool
  default     = false
}

variable "search_lambda_warming_schedule" {
  description = "Schedule expression for search lambda warming (e.g., 'rate(10 minutes)' or 'cron(*/7 * * * ? *)')"
  type        = string
  default     = "rate(5 minutes)"
}