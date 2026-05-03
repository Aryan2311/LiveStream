output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  value = data.aws_region.current.name
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_master_secret_arn" {
  value     = module.rds.master_secret_arn
  sensitive = true
}

output "redis_endpoint" {
  value = module.elasticache.endpoint
}

output "redis_port" {
  value = module.elasticache.port
}

output "media_bucket_name" {
  value = module.storage.bucket_name
}

output "cdn_domain_name" {
  value = module.storage.distribution_domain_name
}

output "app_role_arn" {
  value = module.iam.role_arn
}

output "vpc_id" {
  value = module.network.vpc_id
}
