# Live Streaming Platform

Production-oriented live streaming platform in Go with:

- broadcast-first streaming architecture
- RTMP ingest plus HLS playback
- Kubernetes deployment on AWS EKS
- Docker-based local development stack
- Next.js broadcaster and viewer frontend
- observability via OpenTelemetry, Prometheus, Grafana, Loki, and Tempo
- autoscaling and self-healing deployment primitives

## Repository Layout

- `frontend`: production-style Next.js frontend for broadcasters and viewers
- `cmd/api`: public API gateway and frontend proxy
- `cmd/auth-service`: user registration and login service
- `cmd/stream-service`: stream lifecycle and orchestration service
- `cmd/chat-service`: live chat service using SSE and optional Redis fanout
- `internal/platform`: shared runtime packages
- `internal/auth`: auth domain logic
- `internal/stream`: stream orchestration logic
- `internal/chat`: chat domain logic
- `deploy/docker`: local development stack
- `deploy/k8s`: Kubernetes base and overlays
- `deploy/terraform/aws`: AWS foundation infrastructure
- `observability`: monitoring, logs, traces, and dashboards
- `docs/architecture`: architecture docs, ADRs, SLOs, and runbooks
- `docs/PLATFORM_DEEP_DIVE.md`: end-to-end technical and architectural guide (stack, flows, security, deploy)

## Quick Start

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start the local platform:

```powershell
docker compose -f deploy/docker/docker-compose.yml up --build
```

3. Open:

- Frontend: `http://localhost:3001`
- API edge: `http://localhost:8080`
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- MediaMTX HLS: `http://localhost:8888`

## Developer Commands

```powershell
go test ./...
go build ./cmd/...
```

## Streaming Flow

1. Register or sign in through the Next.js frontend.
2. Create a stream from the studio to receive RTMP ingest and signed HLS playback URLs.
3. Publish to the returned RTMP URL from OBS or another encoder.
4. Open the generated watch page and confirm playback plus chat activity.

## Production Notes

- Use CloudFront in front of playback origins.
- Store long-lived artifacts in S3.
- Run control plane services on separate node groups from media workloads.
- Enable Karpenter or Cluster Autoscaler for burst handling.
- Back services with multi-AZ RDS and ElastiCache.
