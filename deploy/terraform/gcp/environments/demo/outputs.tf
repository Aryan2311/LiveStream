output "external_ip" {
  description = "Public IP for the demo deployment."
  value       = module.compute.external_ip
}

output "app_url" {
  description = "Open this URL to use the platform."
  value       = "http://${module.compute.external_ip}"
}

output "rtmp_ingest_url" {
  description = "RTMP ingest base URL for OBS."
  value       = "rtmp://${module.compute.external_ip}:1935/live"
}

output "artifact_registry_url" {
  description = "Push container images here before first deploy."
  value       = module.artifact_registry.repository_url
}

output "instance_name" {
  value = module.compute.instance_name
}

output "instance_zone" {
  value = module.compute.instance_zone
}
