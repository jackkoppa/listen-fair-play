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

# Custom domain outputs
output "custom_domain_name" {
  description = "The custom domain name configured for CloudFront"
  value       = var.custom_domain_name
}

output "certificate_validation_records" {
  description = "DNS records needed for SSL certificate validation (add these to Namecheap)"
  value = var.custom_domain_name != "" ? {
    for dvo in aws_acm_certificate.custom_domain[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      value  = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}
}

output "dns_instructions" {
  description = "Instructions for DNS configuration in Namecheap"
  value = var.custom_domain_name != "" ? {
    message = "Add the following DNS records in your Namecheap DNS management:"
    certificate_validation = "1. Add the CNAME record from 'certificate_validation_records' output for SSL certificate validation"
    domain_pointing = "2. After certificate validation is complete, add: CNAME ${var.custom_domain_name} -> ${module.cloudfront.cloudfront_domain_name}"
    cloudfront_domain = module.cloudfront.cloudfront_domain_name
  } : null
} 