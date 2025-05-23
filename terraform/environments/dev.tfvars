aws_region                      = "us-east-1"
environment                     = "dev"
s3_bucket_name                  = "listen-fair-play-s3-dev"
log_level                       = "info"
custom_domain_name              = "listenfairplay.com"
root_domain_name                = "listenfairplay.com"
enable_custom_domain_on_cloudfront = true
# openai_api_key = "sk-..." # Don't store this in the file, use environment variable or AWS Secrets Manager 