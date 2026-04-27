variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  type    = list(string)
  default = []
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.name}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
    description     = "Redis from EKS nodes"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name}-redis"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_elasticache_serverless_cache" "redis" {
  engine = "redis"
  name   = "${var.name}-redis"

  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.redis.id]

  cache_usage_limits {
    data_storage {
      maximum = 10
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = 5000
    }
  }

  tags = {
    Name = "${var.name}-redis"
  }
}

output "endpoint" {
  value = aws_elasticache_serverless_cache.redis.endpoint[0].address
}

output "port" {
  value = aws_elasticache_serverless_cache.redis.endpoint[0].port
}
