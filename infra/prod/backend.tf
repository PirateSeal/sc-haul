terraform {
  backend "s3" {
    # bucket supplied at init time — keeps account ID out of version control.
    # Locally:  terraform init -backend-config=backend.hcl
    # CI:       terraform init -backend-config="bucket=$TF_STATE_BUCKET"
    key          = "prod/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
  }
}
