output "external_ip" {
  description = "Public IP for the demo deployment."
  value       = module.compute.external_ip
}

output "app_url" {
  description = "Open this URL to use the platform."
  value       = "https://${local.public_host}"
}

output "custom_domain" {
  description = "Configured custom domain, if any."
  value       = trimspace(var.custom_domain)
}

output "rtmp_ingest_url" {
  description = "RTMP ingest base URL for OBS (use VM IP; Cloudflare proxy does not support RTMP)."
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
