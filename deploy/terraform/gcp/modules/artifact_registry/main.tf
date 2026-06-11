resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.region
  repository_id = "${var.name}-images"
  description   = "Container images for the live streaming platform demo"
  format        = "DOCKER"
}
