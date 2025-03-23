variable "bucket_name" {
  description = "The name of the S3 bucket"
  type        = string
}

variable "bucket_regional_domain_name" {
  description = "The regional domain name of the S3 bucket"
  type        = string
}

variable "environment" {
  description = "The environment name (e.g. dev, staging, prod)"
  type        = string
} 