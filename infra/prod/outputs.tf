output "cloudfront_distribution_id" {
  description = "Set as CF_DISTRIBUTION_ID GitHub variable for deploy workflow"
  value       = module.cdn.distribution_id
}

output "site_bucket_id" {
  description = "Set as SITE_BUCKET_ID GitHub variable for deploy workflow"
  value       = module.site.bucket_id
}

output "app_url" {
  value = "https://${var.subdomain}"
}

output "app_registry_tag" {
  description = "Paste this into var.app_registry_tag in terraform.tfvars for subsequent applies"
  value       = module.app_registry.application_tag
}
