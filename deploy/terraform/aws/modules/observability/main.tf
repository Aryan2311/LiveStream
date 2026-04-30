variable "name" {
  type = string
}

resource "aws_cloudwatch_log_group" "platform" {
  name              = "/platform/${var.name}"
  retention_in_days = 30
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.platform.name
}
