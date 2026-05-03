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
  name       = "live-prod"
  cidr_block = "10.30.0.0/16"
}

module "eks" {
  source       = "../../modules/eks"
  cluster_name = "live-prod"
  subnet_ids   = module.network.private_subnet_ids
}
