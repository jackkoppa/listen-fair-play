output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.s3_distribution.domain_name
}

output "cloudfront_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.s3_distribution.id
}

output "cloudfront_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.s3_distribution.arn
} 