#!/bin/bash
set -euo pipefail
exec > /var/log/live-stream-startup.log 2>&1

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git jq

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

APP_DIR="/opt/live-stream"
REPO_URL="${repo_url}"
REPO_BRANCH="${repo_branch}"

mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/$REPO_BRANCH"
else
  git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

cat > .env.gcp <<EOF
APP_ENV=production
APP_VERSION=demo
LOG_LEVEL=info
BOOTSTRAP_ADMIN_EMAILS=
JWT_SECRET=${jwt_secret}
INTERNAL_SERVICE_TOKEN=${internal_service_token}
PLAYBACK_SIGNING_KEY=${playback_signing_key}
INGEST_SIGNING_KEY=${ingest_signing_key}
POSTGRES_DSN=postgres://postgres:${postgres_password}@postgres:5432/live?sslmode=disable
REDIS_ADDR=redis:6379
NATS_URL=nats://nats:4222
AWS_REGION=${region}
AWS_ACCESS_KEY_ID=minio
AWS_SECRET_ACCESS_KEY=minio123
MEDIA_BUCKET_NAME=live-demo-media-artifacts
S3_ENDPOINT=http://minio:9000
S3_USE_PATH_STYLE=true
ASSET_PUBLIC_BASE_URL=http://${static_ip}/assets
UPLOAD_URL_EXPIRY=15m
AUTH_SERVICE_URL=http://auth-service:8081
STREAM_SERVICE_URL=http://stream-service:8082
CHAT_SERVICE_URL=http://chat-service:8083
FRONTEND_URL=http://frontend:3000
API_PROXY_TARGET=http://api:8080
NEXT_PUBLIC_API_BASE_URL=
OTEL_EXPORTER_OTLP_ENDPOINT=
PUBLIC_BASE_URL=http://${static_ip}
RTMP_BASE_URL=rtmp://${static_ip}:1935
HLS_BASE_URL=http://mediamtx:8888/live
WHIP_BASE_URL=http://${static_ip}/whip
STREAM_APP_NAME=live
STREAM_PUBLISH_TTL=24h
MEDIA_WEBHOOK_HEADER_NAME=X-Internal-Service-Token
MEDIA_WEBHOOK_CLOCK_SKEW=5m
POSTGRES_PASSWORD=${postgres_password}
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio123
IMAGE_REGISTRY=${image_repository}
IMAGE_TAG=${image_tag}
EOF

mkdir -p deploy/docker/generated
cat > deploy/docker/generated/mediamtx.gcp.yml <<EOF
logLevel: info

api: yes
apiAddress: :9997

authInternalUsers:
  - user: any
    pass:
    ips: []
    permissions:
      - action: publish
        path:
      - action: read
        path:
      - action: playback
        path:
      - action: api
        path:
      - action: metrics
        path:

rtmp: yes
rtmpAddress: :1935

hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsDirectory: /tmp/mediamtx-hls

webrtc: yes
webrtcAddress: :8889
webrtcLocalUDPAddress: :8189
webrtcAdditionalHosts:
  - ${static_ip}
webrtcICEServers2: []

paths:
  "~^live/.+$":
    source: publisher
EOF

export IMAGE_REGISTRY="${image_repository}"
export IMAGE_TAG="${image_tag}"

docker compose -f deploy/docker/docker-compose.gcp.yml --env-file .env.gcp up -d --build --remove-orphans
docker compose -f deploy/docker/docker-compose.gcp.yml --env-file .env.gcp ps > /var/log/live-stream-compose.log 2>&1 || true
