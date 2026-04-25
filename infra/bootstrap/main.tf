terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Bootstrap uses local state — commit infra/bootstrap/terraform.tfstate to track it,
  # or keep it out-of-tree. Never migrate bootstrap state into itself.
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

# ── State bucket ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "tfstate" {
  bucket = "sc-haul-tfstate-${data.aws_caller_identity.current.account_id}"

  tags = {
    Application = "sc-haul"
    ManagedBy   = "terraform-bootstrap"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# ── GitHub OIDC provider ─────────────────────────────────────────────────────────

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# ── CI IAM role (assumed by GitHub Actions via OIDC) ────────────────────────────

data "aws_iam_policy_document" "ci_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # Allow pushes to master AND pull requests
      values = [
        "repo:${var.github_repo}:ref:refs/heads/master",
        "repo:${var.github_repo}:ref:refs/tags/*",
        "repo:${var.github_repo}:pull_request",
      ]
    }
  }
}

resource "aws_iam_role" "ci" {
  name               = "sc-haul-ci"
  assume_role_policy = data.aws_iam_policy_document.ci_trust.json

  tags = {
    Application = "sc-haul"
    ManagedBy   = "terraform-bootstrap"
  }
}

# PowerUserAccess lets CI manage most AWS resources.
# IAM is restricted separately below so CI cannot escalate privileges.
resource "aws_iam_role_policy_attachment" "ci_power_user" {
  role       = aws_iam_role.ci.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# Scoped IAM permissions needed for Terraform resource creation
data "aws_iam_policy_document" "ci_iam" {
  # Allow creating/managing roles and policies for Lambda and CI itself,
  # but only for resources scoped to this project.
  statement {
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:PassRole",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/sc-haul-*",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:ListPolicyVersions",
      "iam:TagPolicy",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/sc-haul-*",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:GetOpenIDConnectProvider",
      "iam:TagOpenIDConnectProvider",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ci_iam" {
  name   = "sc-haul-ci-iam"
  role   = aws_iam_role.ci.id
  policy = data.aws_iam_policy_document.ci_iam.json
}

# Allow CI to read/write the TF state bucket
data "aws_iam_policy_document" "ci_tfstate" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetBucketVersioning",
    ]
    resources = [
      aws_s3_bucket.tfstate.arn,
      "${aws_s3_bucket.tfstate.arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "ci_tfstate" {
  name   = "sc-haul-ci-tfstate"
  role   = aws_iam_role.ci.id
  policy = data.aws_iam_policy_document.ci_tfstate.json
}
