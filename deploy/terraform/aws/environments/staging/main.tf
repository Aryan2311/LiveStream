terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

module "network" {
  source     = "../../modules/network"
  name       = "live-staging"
  cidr_block = "10.20.0.0/16"
}

module "eks" {
  source       = "../../modules/eks"
  cluster_name = "live-staging"
  subnet_ids   = module.network.private_subnet_ids
}
