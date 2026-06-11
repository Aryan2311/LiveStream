variable "project_id" {
  type        = string
  description = "GCP project ID."
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "name" {
  type    = string
  default = "live-demo"
}

variable "cidr_block" {
  type    = string
  default = "10.20.0.0/24"
}

variable "machine_type" {
  type        = string
  description = "Demo VM size. e2-standard-4 is recommended; e2-medium works for light demos."
  default     = "e2-standard-4"
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

variable "ssh_source_ranges" {
  type        = list(string)
  description = "Restrict SSH access for the demo VM."
  default     = ["0.0.0.0/0"]
}
