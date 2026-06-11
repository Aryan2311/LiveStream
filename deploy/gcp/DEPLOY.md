# GCP Demo Deployment

Low-cost demo deployment for the live streaming platform on Google Cloud.

## What gets created

Terraform provisions only what the demo needs:

- VPC + subnet + firewall rules
- Artifact Registry repository
- One Compute Engine VM with a static public IP
- In-cluster on the VM: Postgres, Redis, NATS, MinIO, MediaMTX, API, auth, stream, chat, frontend, nginx edge

**Skipped for cost savings** (still documented elsewhere for production scale):

- GKE / Autopilot
- Cloud SQL
- Memorystore
- Cloud CDN / Cloud Armor
- Cloud NAT
- Observability stack

Estimated cost: roughly **$35–70/month** depending on VM size and egress.

## Prerequisites

- GCP project with billing enabled
- `gcloud` CLI authenticated
- `terraform` >= 1.8
- `docker` for building images

Enable required APIs:

```powershell
gcloud services enable compute.googleapis.com artifactregistry.googleapis.com `
  iam.googleapis.com --project YOUR_PROJECT_ID
```

## Deploy

1. Copy and edit Terraform variables:

```powershell
Copy-Item deploy/terraform/gcp/environments/demo/terraform.tfvars.example `
  deploy/terraform/gcp/environments/demo/terraform.tfvars
```

Set `project_id` in `terraform.tfvars`.

2. Build and push images (recommended before first VM boot):

```powershell
make gcp-build-push GCP_PROJECT=YOUR_PROJECT_ID
```

3. Apply infrastructure:

```powershell
make gcp-deploy-infra GCP_PROJECT=YOUR_PROJECT_ID
```

4. Open the app:

```powershell
terraform -chdir=deploy/terraform/gcp/environments/demo output app_url
```

RTMP ingest base:

```powershell
terraform -chdir=deploy/terraform/gcp/environments/demo output rtmp_ingest_url
```

## One-shot deploy

```powershell
make gcp-deploy-all GCP_PROJECT=YOUR_PROJECT_ID
```

## Re-deploy after code changes

```powershell
make gcp-build-push GCP_PROJECT=YOUR_PROJECT_ID TAG=v2
make gcp-restart-demo GCP_PROJECT=YOUR_PROJECT_ID
```

Update `image_tag` in `terraform.tfvars` if you change the tag permanently.

## SSH troubleshooting

```powershell
gcloud compute ssh live-demo-demo --zone us-central1-a --project YOUR_PROJECT_ID
sudo docker compose -f /opt/live-stream/deploy/docker/docker-compose.gcp.yml --env-file /opt/live-stream/.env.gcp ps
```

## Local test of GCP compose stack

```powershell
Copy-Item .env.gcp.example .env.gcp
mkdir -p deploy/docker/generated
Copy-Item deploy/docker/mediamtx.yml deploy/docker/generated/mediamtx.gcp.yml
docker compose -f deploy/docker/docker-compose.gcp.yml --env-file .env.gcp up --build
```

Open `http://localhost`.
