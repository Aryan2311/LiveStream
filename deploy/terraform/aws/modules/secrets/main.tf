variable "name" {
  type = string
}

resource "aws_secretsmanager_secret" "jwt" {
  name = "${var.name}/jwt"
}

resource "aws_secretsmanager_secret" "stream_signing" {
  name = "${var.name}/stream-signing"
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt.arn
}
