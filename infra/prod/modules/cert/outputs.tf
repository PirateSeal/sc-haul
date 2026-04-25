output "certificate_arn" {
  description = "Validated ACM certificate ARN (us-east-1)"
  value       = aws_acm_certificate_validation.this.certificate_arn
}
