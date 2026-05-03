terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "live-dev-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "live-dev-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "live-streaming-platform"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

module "network" {
  source     = "../../modules/network"
  name       = "live-dev"
  cidr_block = "10.10.0.0/16"
}

module "eks" {
  source       = "../../modules/eks"
  cluster_name = "live-dev"
  vpc_id       = module.network.vpc_id
  subnet_ids   = module.network.private_subnet_ids
}

module "rds" {
  source                     = "../../modules/rds"
  name                       = "live-dev"
  db_name                    = "live"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.eks.node_security_group_id]
}

module "elasticache" {
  source                     = "../../modules/elasticache"
  name                       = "live-dev"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.eks.node_security_group_id]
}

module "storage" {
  source      = "../../modules/storage"
  name        = "live-dev"
  waf_acl_arn = module.edge.web_acl_arn
}

module "ecr" {
  source = "../../modules/ecr"
  name   = "live-dev"
}

module "iam" {
  source            = "../../modules/iam"
  name              = "live-dev"
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_provider     = module.eks.oidc_provider
  namespace         = "live-dev"
}

module "edge" {
  source = "../../modules/edge"
  name   = "live-dev"
}

module "secrets" {
  source = "../../modules/secrets"
  name   = "live-dev"
}

module "observability" {
  source = "../../modules/observability"
  name   = "live-dev"
}
