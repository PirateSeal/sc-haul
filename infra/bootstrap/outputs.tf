output "tfstate_bucket" {
  description = "Name of the Terraform state S3 bucket"
  value       = aws_s3_bucket.tfstate.id
}

output "ci_role_arn" {
  description = "ARN of the sc-haul-ci IAM role — set as AWS_ROLE_ARN GitHub repo variable"
  value       = aws_iam_role.ci.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  value       = data.aws_iam_openid_connect_provider.github.arn
}
