variable "subdomain" {
  description = "Hostname to issue ACM cert for"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS validation"
  type        = string
}
