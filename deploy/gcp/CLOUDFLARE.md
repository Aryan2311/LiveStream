# Cloudflare custom domain and SSL

Use Cloudflare in front of the GCP demo VM for a trusted HTTPS certificate on your own hostname. Browsers will trust the site without self-signed warnings, which also fixes camera/microphone access in the browser studio.

## Architecture

```text
Browser ──HTTPS──► Cloudflare (edge SSL) ──HTTPS──► nginx on VM :443 ──► app stack
OBS/RTMP ─────────────────────────────────────────► VM :1935 (bypass Cloudflare proxy)
```

Cloudflare's HTTP proxy does **not** support RTMP on port 1935. Keep OBS pointed at the VM IP (or a separate DNS-only `ingest` record).

## 1. Add DNS in Cloudflare

1. Add your domain to Cloudflare (or use an existing zone).
2. Create an **A** record:
   - **Name**: `live` (or your preferred subdomain)
   - **IPv4**: your VM public IP (from `terraform output external_ip`)
   - **Proxy status**: **Proxied** (orange cloud)
3. Wait for DNS to propagate (usually a few minutes).

Example: `live.example.com` → `35.225.198.43` (proxied)

## 2. Set SSL mode to Full (strict)

1. Cloudflare dashboard → **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**

## 3. Create a Cloudflare origin certificate

1. **SSL/TLS** → **Origin Server** → **Create Certificate**
2. Hostnames: include your app hostname, e.g. `live.example.com`
3. Validity: 15 years (default)
4. Save the certificate and private key as local files (do not commit them):

```text
deploy/terraform/gcp/environments/demo/cloudflare-origin.pem
deploy/terraform/gcp/environments/demo/cloudflare-origin-key.pem
```

These paths are gitignored.

## 4. Configure Terraform

Edit `deploy/terraform/gcp/environments/demo/terraform.tfvars`:

```hcl
custom_domain = "live.example.com"
cloudflare_origin_cert_file = "cloudflare-origin.pem"
cloudflare_origin_key_file  = "cloudflare-origin-key.pem"
```

Apply (updates VM startup metadata for future reprovisions):

```powershell
$env:GOOGLE_OAUTH_ACCESS_TOKEN = (gcloud auth print-access-token)
cd deploy/terraform/gcp/environments/demo
terraform apply
```

## 5. Apply to the running VM (no reprovision)

Terraform updates startup metadata but does not re-run it on an existing VM. Use the helper script after DNS and certs are ready:

```powershell
.\scripts\gcp-apply-domain.ps1 `
  -Domain "live.example.com" `
  -CertFile "deploy\terraform\gcp\environments\demo\cloudflare-origin.pem" `
  -KeyFile "deploy\terraform\gcp\environments\demo\cloudflare-origin-key.pem"
```

Or on the VM directly:

```bash
sudo bash /opt/live-stream/deploy/gcp/apply-domain-on-vm.sh \
  live.example.com \
  /path/to/cloudflare-origin.pem \
  /path/to/cloudflare-origin-key.pem
```

## 6. Verify

1. Open `https://live.example.com` — padlock should show a valid certificate (issued by Cloudflare).
2. Open `/studio`, click **Enable camera and microphone**, allow permissions.
3. OBS still uses `rtmp://<VM_IP>:1935/live/<stream-key>`.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| 525 SSL handshake failed | Origin cert not installed on VM, or hostname mismatch. Re-run apply script. |
| 526 Invalid origin cert | Cloudflare mode is Full (strict) but origin has wrong/missing cert. |
| Too many redirects | Set SSL mode to **Full (strict)**, not Flexible. |
| Camera still blocked | Confirm URL is `https://your-domain`, not the raw IP. |
| RTMP fails on domain | Expected — use the VM IP for RTMP ingest. |

## Optional: DNS-only ingest hostname

For a cleaner OBS URL without Cloudflare proxy:

1. Add `ingest.example.com` → VM IP, **DNS only** (grey cloud)
2. Use `rtmp://ingest.example.com:1935/live/<key>` in OBS

WebRTC UDP (port 8189) also requires a direct connection; the domain A record alone is not enough unless UDP reaches the VM.
