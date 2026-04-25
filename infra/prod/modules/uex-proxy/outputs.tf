output "function_url" {
  description = "Lambda Function URL (https://...)"
  value       = aws_lambda_function_url.this.function_url
}

output "cf_secret_param_name" {
  description = "SSM parameter name holding the CF shared secret — read by Lambda at cold start"
  value       = aws_ssm_parameter.cf_secret.name
}

output "cf_secret_value" {
  description = "CF shared secret plaintext — passed to CloudFront origin custom header"
  value       = random_password.cf_secret.result
  sensitive   = true
}
