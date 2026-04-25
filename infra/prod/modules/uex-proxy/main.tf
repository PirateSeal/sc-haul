resource "random_password" "cf_secret" {
  length  = 32
  special = false
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/.build/uex-proxy.zip"
}

# SSM params — seeded out-of-band via AWS CLI, TF manages lifecycle only
resource "aws_ssm_parameter" "uex_token" {
  name  = var.ssm_param_uex_token
  type  = "SecureString"
  value = "REPLACE_ME"

  lifecycle {
    # Never overwrite the real token with the placeholder after first apply
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "cf_secret" {
  name  = var.ssm_param_cf_secret
  type  = "SecureString"
  value = random_password.cf_secret.result
}

# IAM execution role
data "aws_iam_policy_document" "lambda_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "sc-haul-uex-proxy"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_ssm" {
  statement {
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [
      aws_ssm_parameter.uex_token.arn,
      aws_ssm_parameter.cf_secret.arn,
    ]
  }
}

resource "aws_iam_role_policy" "lambda_ssm" {
  name   = "sc-haul-uex-proxy-ssm"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_ssm.json
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/sc-haul-uex-proxy"
  retention_in_days = 14
}

resource "aws_lambda_function" "this" {
  function_name    = "sc-haul-uex-proxy"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      SSM_PARAM_UEX_TOKEN = var.ssm_param_uex_token
      SSM_PARAM_CF_SECRET = var.ssm_param_cf_secret
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"
}
