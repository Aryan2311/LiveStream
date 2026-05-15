# Validation Guide

## Load Smoke

- Run `k6 run tests/load/k6-smoke.js`
- Override `BASE_URL` to target staging or production

## Chaos Check

- Apply `tests/chaos/pod-kill.yaml` against a non-production cluster first
- Confirm service availability remains intact during pod churn

## Expected Outcomes

- Liveness and readiness probes keep traffic away from unhealthy pods
- Horizontal scaling maintains control-plane responsiveness
- Stream sessions and chat state survive single-pod failures
