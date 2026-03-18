# Current Convex Engine Already Reimplements a Workflow Runtime

**Confidence:** 0.89

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/schema.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/base.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts

**Summary:**
The current engine has clear domain tables, but it also contains a substantial amount of execution-runtime machinery inside Convex. The queue/runtime layer includes `llm_jobs`, `llm_batches`, `llm_requests`, `process_request_targets`, and `scheduler_locks`, plus a global scheduler loop that scans for queued, running, orphaned, and retryable work and reschedules handlers on a polling interval. Stage completion in runs and windows is gated not just by domain artifacts landing, but also by derived resolution state and active transport checks.

This means the system is not merely storing domain truth in Convex. It is also implementing a custom worker runtime: dispatch, lease claims, retries, reconciliation, and liveness tracking. That is the strongest local evidence that the rewrite opportunity is not “replace Convex” but “remove execution concerns from Convex and keep domain concerns there.”

