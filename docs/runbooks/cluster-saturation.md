# Cluster Saturation Runbook

## Symptoms

- Pending pods
- Rising pod evictions
- CPU throttling or memory pressure

## Actions

1. Check HPA activity and node group headroom.
2. Verify Karpenter or Cluster Autoscaler events.
3. Shift media workloads away from control-plane nodes if taints or tolerations drifted.
4. Reduce noisy batch jobs before impacting live traffic.
