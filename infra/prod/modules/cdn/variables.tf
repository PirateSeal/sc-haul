variable "subdomain" {
  description = "CloudFront alias hostname"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM cert ARN in us-east-1"
  type        = string
}

variable "s3_bucket_regional_domain" {
  description = "S3 bucket regional domain name (for OAC origin)"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket ID"
  type        = string
}

variable "oac_id" {
  description = "CloudFront Origin Access Control ID"
  type        = string
}

variable "lambda_function_url" {
  description = "Lambda Function URL for the UEX proxy (https://...)"
  type        = string
}

variable "cf_shared_secret" {
  description = "Shared secret injected as X-CF-Secret header to Lambda"
  type        = string
  sensitive   = true
}
