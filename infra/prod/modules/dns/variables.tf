variable "domain" {
  description = "Apex domain to create a hosted zone for"
  type        = string
}

variable "subdomain" {
  description = "Full hostname to point at CloudFront"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID (always Z2FDTNDATAQYW2)"
  type        = string
  default     = "Z2FDTNDATAQYW2"
}
