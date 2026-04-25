data "aws_route53_zone" "apex" {
  name         = var.domain
  private_zone = false
}

resource "aws_route53_record" "app_a" {
  zone_id = data.aws_route53_zone.apex.zone_id
  name    = var.subdomain
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "app_aaaa" {
  zone_id = data.aws_route53_zone.apex.zone_id
  name    = var.subdomain
  type    = "AAAA"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}
