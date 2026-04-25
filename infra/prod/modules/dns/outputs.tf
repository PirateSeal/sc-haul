output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = data.aws_route53_zone.apex.zone_id
}
