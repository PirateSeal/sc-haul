output "application_tag" {
  description = "Value for the awsApplication tag — feed back into providers.tf default_tags"
  value       = aws_servicecatalogappregistry_application.this.application_tag["awsApplication"]
}

output "application_arn" {
  value = aws_servicecatalogappregistry_application.this.arn
}
