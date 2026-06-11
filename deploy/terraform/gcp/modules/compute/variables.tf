variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "zone" {
  type = string
}

variable "name" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "machine_type" {
  type    = string
  default = "e2-standard-4"
}

variable "image_repository" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "repo_url" {
  type    = string
  default = "https://github.com/Aryan2311/LiveStream.git"
}

variable "repo_branch" {
  type    = string
  default = "main"
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "internal_service_token" {
  type      = string
  sensitive = true
}

variable "playback_signing_key" {
  type      = string
  sensitive = true
}

variable "ingest_signing_key" {
  type      = string
  sensitive = true
}

variable "postgres_password" {
  type      = string
  sensitive = true
}
