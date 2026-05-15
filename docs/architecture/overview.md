# Architecture Overview

## Core Decisions

- Broadcast-first architecture using RTMP ingest and HLS or LL-HLS playback.
- Go control plane services for auth, stream lifecycle, and chat.
- Media edge separated from control plane for independent scaling.
- AWS managed services for durability and operational simplicity.
- Kubernetes for orchestration, self-healing, and progressive delivery.

## Request Paths

- Broadcaster traffic enters the media tier through RTMP or SRT.
- Viewer playback is served from HLS origins and should be fronted by CloudFront in production.
- Viewer and broadcaster application traffic hits the API gateway, which proxies to internal services.
- Events and workflows are published through NATS for decoupled processing.

## Self-Healing Controls

- Health probes on every workload.
- Pod anti-affinity on ingest tier.
- Multiple replicas for stateless services.
- Readiness gates during rollouts.
- Infrastructure defined as code for rapid redeploy.
