resource "google_compute_network" "this" {
  name                    = "${var.name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "this" {
  name          = "${var.name}-subnet"
  ip_cidr_range = var.cidr_block
  region        = var.region
  network       = google_compute_network.this.id
}

resource "google_compute_firewall" "allow_http" {
  name    = "${var.name}-allow-http"
  network = google_compute_network.this.name

  target_tags = ["${var.name}-demo"]

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3001", "8080"]
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_rtmp" {
  name    = "${var.name}-allow-rtmp"
  network = google_compute_network.this.name

  target_tags = ["${var.name}-demo"]

  allow {
    protocol = "tcp"
    ports    = ["1935"]
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_webrtc_udp" {
  name    = "${var.name}-allow-webrtc-udp"
  network = google_compute_network.this.name

  target_tags = ["${var.name}-demo"]

  allow {
    protocol = "udp"
    ports    = ["8189"]
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.name}-allow-ssh"
  network = google_compute_network.this.name

  target_tags = ["${var.name}-demo"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
}
