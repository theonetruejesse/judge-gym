# Scheduler Caps And Stage Advancement Semantics

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts

**Summary:**
Scheduler dispatch is intentionally bounded per tick for queued/running jobs and batches, which protects runaway growth but can elongate drain time under bursty load. Scheduler lock acquisition is single-instance with a short lease, and scheduler self-reschedule depends on active work checks. Stage progression can be triggered both during per-request apply and again after transport finalization reconciliation, so strict ordering is eventual rather than single-point terminal-first.
