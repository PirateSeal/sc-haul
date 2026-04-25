variable "domain" {
  description = "Apex domain managed in Route53"
  type        = string
  default     = "tcousin.com"
}

variable "subdomain" {
  description = "Full hostname to deploy to"
  type        = string
  default     = "sc-haul.tcousin.com"
}

variable "github_repo" {
  description = "GitHub repo owner/name for OIDC trust"
  type        = string
  default     = "PirateSeal/sc-haul"
}

variable "app_registry_tag" {
  description = "Value of the awsApplication tag from the AppRegistry module (feed back in after first apply)"
  type        = string
  default     = ""
}
