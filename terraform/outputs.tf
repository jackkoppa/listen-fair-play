output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.s3_bucket.bucket_name
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cloudfront.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cloudfront.cloudfront_id
}

output "rss_lambda_function_name" {
  description = "Name of the RSS processing Lambda function"
  value       = module.rss_lambda.lambda_function_name
}

output "whisper_lambda_function_name" {
  description = "Name of the Whisper transcription Lambda function"
  value       = module.whisper_lambda.lambda_function_name
}

output "search_api_invoke_url" {
  description = "The invoke URL for the Search API Gateway"
  value       = aws_apigatewayv2_stage.search_api_stage.invoke_url
}

output "terraform_state_bucket_name" {
  description = "The name of the S3 bucket used for storing Terraform state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "search_lambda_function_name" {
  description = "Name of the Search Lambda function"
  value       = module.search_lambda.lambda_function_name
}

output "search_lambda_warming_enabled" {
  description = "Whether search lambda warming is enabled"
  value       = var.enable_search_lambda_warming
}

output "search_lambda_warming_schedule" {
  description = "Schedule expression for search lambda warming (if enabled)"
  value       = var.enable_search_lambda_warming ? var.search_lambda_warming_schedule : "disabled"
} 