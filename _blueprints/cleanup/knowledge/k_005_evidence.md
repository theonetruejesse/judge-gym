# Refactor-everything uses evidence workflows and centralized run scheduler

**Confidence:** 0.66

**Sources:**
- refactor-everything:packages/engine/convex/domain/evidence/workflows/evidence_collect.ts
- refactor-everything:packages/engine/convex/domain/runs/workflows/runs_scheduler.ts

**Summary:**
In the refactor-everything branch, evidence collection and LLM request queuing are handled in a dedicated evidence workflow that directly creates requests with stage tags (e.g., evidence_clean/neutralize/abstract). Scheduling is centralized in a runs scheduler that polls/queues batches based on run policies, rather than orchestrator/target_registry indirection.
