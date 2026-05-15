# GitOps Delivery

## Recommended Tooling

- Argo CD for environment reconciliation
- ECR for image storage
- GitHub Actions for CI validation and image publishing

## Promotion Model

1. Merge validated changes to `main`.
2. Build and publish immutable images.
3. Update staging overlay image tags.
4. Promote to production after validation gates and error budget review.

## Cluster Policies

- Enforce readiness and liveness probes on all deployments.
- Require resource requests and limits.
- Keep media workloads on dedicated node groups.
