output "instance_name" {
  value = google_compute_instance.demo.name
}

output "instance_zone" {
  value = google_compute_instance.demo.zone
}

output "external_ip" {
  value = google_compute_address.demo.address
}

output "service_account_email" {
  value = google_service_account.demo.email
}
