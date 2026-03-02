# Observability Gap: Mutable State, Sparse Event Trail

**Confidence:** 0.91

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/schema.ts:1
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:136

**Summary:**
Current schema has orchestration state tables (`llm_requests`, `llm_batches`, `llm_jobs`, `runs`, `samples`) but no append-only telemetry events table. Scheduler emits summary `console.info`, which is useful for spot checks but weak for durable forensic reconstruction.
