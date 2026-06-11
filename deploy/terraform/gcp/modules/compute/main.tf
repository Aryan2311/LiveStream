resource "google_service_account" "demo" {
  account_id   = "${var.name}-demo"
  display_name = "Live streaming platform demo VM"
}

resource "google_project_iam_member" "artifact_registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.demo.email}"
}

resource "google_compute_address" "demo" {
  name   = "${var.name}-demo-ip"
  region = var.region
}

resource "google_compute_instance" "demo" {
  name         = "${var.name}-demo"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["${var.name}-demo"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 50
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = var.subnet_id
    access_config {
      nat_ip = google_compute_address.demo.address
    }
  }

  service_account {
    email  = google_service_account.demo.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh.tpl", {
    project_id             = var.project_id
    region                 = var.region
    image_repository       = var.image_repository
    image_tag              = var.image_tag
    repo_url               = var.repo_url
    repo_branch            = var.repo_branch
    jwt_secret             = var.jwt_secret
    internal_service_token = var.internal_service_token
    playback_signing_key   = var.playback_signing_key
    ingest_signing_key     = var.ingest_signing_key
    postgres_password      = var.postgres_password
    static_ip              = google_compute_address.demo.address
  })

  allow_stopping_for_update = true
}
