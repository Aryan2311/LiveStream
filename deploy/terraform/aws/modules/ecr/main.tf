variable "name" {
  type = string
}

locals {
  repositories = [
    "api",
    "auth-service",
    "stream-service",
    "chat-service",
    "frontend"
  ]
}

resource "aws_ecr_repository" "service" {
  for_each = toset(local.repositories)

  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "MUTABLE"

  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = toset(local.repositories)
  repository = aws_ecr_repository.service[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 20 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "repository_urls" {
  value = { for k, v in aws_ecr_repository.service : k => v.repository_url }
}
