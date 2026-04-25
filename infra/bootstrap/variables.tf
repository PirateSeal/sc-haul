variable "aws_region" {
  description = "AWS region for the state bucket"
  type        = string
  default     = "eu-west-1"
}

variable "github_repo" {
  description = "GitHub repo in owner/name format"
  type        = string
  default     = "PirateSeal/sc-haul"
}
