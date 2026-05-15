# Stream Failure Runbook

## Symptoms

- Broadcaster cannot publish to RTMP.
- HLS playlist is missing or stale.
- Viewers report playback stalls.

## Checks

1. Verify `mediamtx` pod readiness and restart count.
2. Check ingest node pressure and network saturation.
3. Confirm stream exists in `stream-service`.
4. Validate the published stream key and generated HLS path.
5. Inspect traces and logs in Grafana, Loki, and Tempo.

## Immediate Mitigations

1. Drain unhealthy media node if localized.
2. Restart stuck ingest pod after verifying no broader storage issue exists.
3. Scale media tier horizontally if queueing or CPU saturation is observed.
4. Redirect playback through fallback origin if CDN cache is stale.
