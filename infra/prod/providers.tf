locals {
  # Merge AppRegistry application tag so all resources auto-associate with the app in myApplications.
  common_tags = merge(
    {
      Application = "sc-haul"
      Environment = "prod"
      ManagedBy   = "terraform"
      Repo        = "PirateSeal/sc-haul"
    },
    # awsApplication tag fed from app-registry module output after first apply.
    # On the very first apply this will be empty; AppRegistry association still works
    # via the module's aws_servicecatalogappregistry_resource_association resources.
    var.app_registry_tag != "" ? { awsApplication = var.app_registry_tag } : {}
  )
}

provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = local.common_tags
  }
}

# Separate provider alias required for CloudFront ACM certs (must be us-east-1).
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}
