terraform {
  required_version = ">= 1.8.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # For demo use local state. Uncomment for team use:
  # backend "gcs" {
  #   bucket = "live-demo-terraform-state"
  #   prefix = "demo"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

resource "random_password" "internal_service_token" {
  length  = 32
  special = false
}

resource "random_password" "playback_signing_key" {
  length  = 32
  special = false
}

resource "random_password" "ingest_signing_key" {
  length  = 32
  special = false
}

resource "random_password" "postgres_password" {
  length  = 24
  special = false
}

locals {
  origin_cert_b64 = var.cloudflare_origin_cert_file != "" ? base64encode(file(var.cloudflare_origin_cert_file)) : ""
  origin_key_b64  = var.cloudflare_origin_key_file != "" ? base64encode(file(var.cloudflare_origin_key_file)) : ""
  public_host     = trimspace(var.custom_domain) != "" ? trimspace(var.custom_domain) : module.compute.external_ip
}

module "network" {
  source              = "../../modules/network"
  name                = var.name
  region              = var.region
  cidr_block          = var.cidr_block
  ssh_source_ranges   = var.ssh_source_ranges
}

module "artifact_registry" {
  source     = "../../modules/artifact_registry"
  project_id = var.project_id
  region     = var.region
  name       = var.name
}

module "compute" {
  source                 = "../../modules/compute"
  project_id             = var.project_id
  region                 = var.region
  zone                   = var.zone
  name                   = var.name
  subnet_id              = module.network.subnet_id
  machine_type           = var.machine_type
  image_repository       = module.artifact_registry.repository_url
  image_tag              = var.image_tag
  repo_url               = var.repo_url
  repo_branch            = var.repo_branch
  jwt_secret             = random_password.jwt_secret.result
  internal_service_token = random_password.internal_service_token.result
  playback_signing_key   = random_password.playback_signing_key.result
  ingest_signing_key     = random_password.ingest_signing_key.result
  postgres_password      = random_password.postgres_password.result
  custom_domain          = trimspace(var.custom_domain)
  origin_cert_b64        = local.origin_cert_b64
  origin_key_b64         = local.origin_key_b64

  depends_on = [module.artifact_registry]
}
