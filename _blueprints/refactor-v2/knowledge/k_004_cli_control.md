# CLI Controller + Live Status Patterns

**Confidence:** 0.61

**Sources:**
- https://cli.github.com/manual/gh_workflow_run
- https://cli.github.com/manual/gh_run_cancel
- https://cli.github.com/manual/gh_run_watch
- https://cli.github.com/manual/gh_run_list
- https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_pause/
- https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_status/
- https://docs.aws.amazon.com/cli/latest/reference/ecs/wait/
- https://docs.docker.com/reference/cli/docker/container/wait/
- https://v1-32.docs.kubernetes.io/docs/reference/kubectl/generated/kubectl_logs/

**Summary:**
CLI tools for long-running workflows typically support start, cancel, pause/resume, single-shot status, and watch/polling modes. GitHub CLI exposes explicit run lifecycle commands and watch/list variants; kubectl provides pause/resume for rollouts and watch vs non-watch status. AWS CLI waiters and docker wait represent blocking completion patterns, while `kubectl logs --follow` demonstrates streaming log semantics. Together these establish a clear pattern for CLI control + status inspection with both polling and streaming options.
