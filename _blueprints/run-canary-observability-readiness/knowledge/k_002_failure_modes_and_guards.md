# Failure Modes And Existing Guards

**Confidence:** 0.86

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/tests/orchestrator_idempotency.test.ts

**Summary:**
Core idempotency and lease safety are in place and tested: duplicate apply paths are explicit, and batch/job claim leases prevent concurrent double-processing. Retry behavior distinguishes terminal parse/orchestrator classes from retryable provider classes. Partial-stage semantics are permissive (mixed success/failure can advance), which is intentional but requires clear canary pass criteria so silent attrition is not misread as full success.
