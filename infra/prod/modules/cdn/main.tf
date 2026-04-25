locals {
  s3_origin_id     = "s3-site"
  lambda_origin_id = "lambda-uex-proxy"

  # Strip https:// prefix from Lambda Function URL for CF origin domain
  lambda_domain = trimsuffix(replace(var.lambda_function_url, "https://", ""), "/")
}

# CloudFront Function: SPA route fallback (viewer-request)
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "sc-haul-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true

  code = <<-EOF
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      // Pass through API calls, static assets (have extension), and root
      if (uri.startsWith('/api/') || uri.includes('.') || uri === '/') {
        return request;
      }
      // Rewrite SPA deep links to index.html
      request.uri = '/index.html';
      return request;
    }
  EOF
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  aliases             = [var.subdomain]
  default_root_object = "index.html"

  # ── S3 origin (default) ────────────────────────────────────────────────────

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = var.s3_bucket_regional_domain
    origin_access_control_id = var.oac_id
  }

  # ── Lambda proxy origin ─────────────────────────────────────────────────────

  origin {
    origin_id   = local.lambda_origin_id
    domain_name = local.lambda_domain

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # Shared secret so Lambda rejects requests not from CloudFront
    custom_header {
      name  = "X-CF-Secret"
      value = var.cf_shared_secret
    }
  }

  # ── Default cache behaviour (S3) ────────────────────────────────────────────

  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    # Long cache for hashed assets; index.html / sw.js handled by response headers
    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  # ── /api/uex/* cache behaviour (Lambda proxy) ───────────────────────────────

  ordered_cache_behavior {
    path_pattern           = "/api/uex/*"
    target_origin_id       = local.lambda_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 60
    max_ttl     = 300
  }

  # ── TLS ─────────────────────────────────────────────────────────────────────

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
