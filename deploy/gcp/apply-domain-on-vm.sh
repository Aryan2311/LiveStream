#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
CERT_FILE="${2:-}"
KEY_FILE="${3:-}"
APP_DIR="${APP_DIR:-/opt/live-stream}"
STATIC_IP="${STATIC_IP:-}"

if [ -z "$DOMAIN" ] || [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
  echo "Usage: $0 <domain> <origin-cert.pem> <origin-key.pem>" >&2
  exit 1
fi

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "Certificate files not found." >&2
  exit 1
fi

cd "$APP_DIR"

if [ -z "$STATIC_IP" ]; then
  STATIC_IP="$(curl -fsS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)"
fi

PUBLIC_URL="https://$DOMAIN"

if [ -f .env.gcp ]; then
  sed -i "s|^ASSET_PUBLIC_BASE_URL=.*|ASSET_PUBLIC_BASE_URL=$PUBLIC_URL/assets|" .env.gcp
  sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=$PUBLIC_URL|" .env.gcp
  sed -i "s|^WHIP_BASE_URL=.*|WHIP_BASE_URL=http://mediamtx:8889|" .env.gcp
fi

mkdir -p deploy/docker/generated/certs
cp "$CERT_FILE" deploy/docker/generated/certs/fullchain.pem
cp "$KEY_FILE" deploy/docker/generated/certs/privkey.pem
chmod 600 deploy/docker/generated/certs/privkey.pem

python3 - <<PY
from pathlib import Path

path = Path("deploy/docker/generated/mediamtx.gcp.yml")
text = path.read_text()
lines = text.splitlines()
out = []
in_hosts = False
hosts = [h.strip() for h in ["$STATIC_IP", "$DOMAIN"]]
seen = set()

for line in lines:
    if line.startswith("webrtcAdditionalHosts:"):
        in_hosts = True
        out.append(line)
        for host in hosts:
            if host and host not in seen:
                out.append(f"  - {host}")
                seen.add(host)
        continue
    if in_hosts:
        if line.startswith("  - "):
            host = line.split("-", 1)[1].strip()
            if host not in seen:
                seen.add(host)
            continue
        in_hosts = False
    if line.startswith("webrtcICEServers2:"):
        continue
    out.append(line)

if "webrtcICEServers2: []" not in "\n".join(out):
    insert_at = next(i for i, line in enumerate(out) if line.startswith("paths:"))
    out.insert(insert_at, "webrtcICEServers2: []")
    out.insert(insert_at, "")

path.write_text("\n".join(out) + "\n")
PY

docker compose -f deploy/docker/docker-compose.gcp.yml --env-file .env.gcp up -d --force-recreate edge mediamtx api stream-service frontend

echo "Domain applied: $PUBLIC_URL"
echo "RTMP ingest (use VM IP): rtmp://$STATIC_IP:1935/live/<stream-key>"
