variable "ssm_param_uex_token" {
  description = "SSM SecureString parameter name holding the UEX bearer token"
  type        = string
  default     = "/sc-haul/prod/uex/bearer_token"
}

variable "ssm_param_cf_secret" {
  description = "SSM SecureString parameter name holding the CloudFront shared secret"
  type        = string
  default     = "/sc-haul/prod/cf/shared_secret"
}
