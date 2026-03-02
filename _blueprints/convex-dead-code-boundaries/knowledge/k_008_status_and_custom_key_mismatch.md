# Status Lifecycle and Job/Batch custom_key Usage

**Confidence:** 0.58

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/_shared.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/base.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_repo.ts

**Summary:**
`StateStatusSchema` includes `queued` and `running`, but runs are created with status `start` and only transition to `error` or `completed` in `run_service`. This indicates a partially implemented status lifecycle for runs. Separately, `llm_batches` and `llm_jobs` are created with `custom_key` in `BaseOrchestrator`, but there are no read paths that query `custom_key` for jobs/batches in Convex code, suggesting unused fields unless intended for external observability.
