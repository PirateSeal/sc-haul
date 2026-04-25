data "aws_caller_identity" "current" {}

module "app_registry" {
  source = "./modules/app-registry"
}

module "dns" {
  source = "./modules/dns"

  domain    = var.domain
  subdomain = var.subdomain

  # CloudFront domain fed from cdn module (TF resolves ordering automatically)
  cloudfront_domain_name    = module.cdn.domain_name
  cloudfront_hosted_zone_id = "Z2FDTNDATAQYW2"
}

module "cert" {
  source = "./modules/cert"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  subdomain       = var.subdomain
  route53_zone_id = module.dns.zone_id
}

module "site" {
  source = "./modules/site"

  aws_account_id = data.aws_caller_identity.current.account_id
}

module "uex_proxy" {
  source = "./modules/uex-proxy"
}

module "cdn" {
  source = "./modules/cdn"

  subdomain                 = var.subdomain
  acm_certificate_arn       = module.cert.certificate_arn
  s3_bucket_regional_domain = module.site.bucket_regional_domain_name
  s3_bucket_id              = module.site.bucket_id
  oac_id                    = module.site.oac_id
  lambda_function_url       = module.uex_proxy.function_url
  cf_shared_secret          = module.uex_proxy.cf_secret_value
}

# S3 bucket policy lives here to break the cdn↔site circular dependency
data "aws_iam_policy_document" "site_bucket" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${module.site.bucket_arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [module.cdn.distribution_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = module.site.bucket_id
  policy = data.aws_iam_policy_document.site_bucket.json
}
