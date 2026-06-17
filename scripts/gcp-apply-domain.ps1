param(
    [Parameter(Mandatory = $true)]
    [string]$Domain,

    [Parameter(Mandatory = $true)]
    [string]$CertFile,

    [Parameter(Mandatory = $true)]
    [string]$KeyFile,

    [string]$Project = "live-stream-c1f39c8006",
    [string]$Zone = "us-central1-a",
    [string]$Instance = "live-demo-demo"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$certPath = Resolve-Path $CertFile
$keyPath = Resolve-Path $KeyFile

$remoteCert = "/tmp/cloudflare-origin.pem"
$remoteKey = "/tmp/cloudflare-origin-key.pem"

gcloud compute scp $certPath "${Instance}:${remoteCert}" --zone $Zone --project $Project
gcloud compute scp $keyPath "${Instance}:${remoteKey}" --zone $Zone --project $Project

$cmd = "cd /opt/live-stream && sudo git pull && sudo bash deploy/gcp/apply-domain-on-vm.sh '$Domain' '$remoteCert' '$remoteKey'"
gcloud compute ssh $Instance --zone $Zone --project $Project --command $cmd

Write-Host ""
Write-Host "App URL: https://$Domain"
Write-Host "Studio:  https://$Domain/studio"
