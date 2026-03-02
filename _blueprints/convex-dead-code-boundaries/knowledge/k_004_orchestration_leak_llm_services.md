# Orchestration Logic in LLM Execution Services

**Confidence:** 0.68

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts

**Summary:**
`llm_job_service.applyRequestSuccess` and `llm_batch_service.applyBatchResults` directly resolve and invoke domain handlers via `resolveApplyHandler` / `resolveErrorHandler`, and `llm_batch_service` directly calls `scheduler.requeueRequest` for retries. This mixes orchestration (routing/requeue decisions) into execution services, rather than returning neutral results for a separate orchestration layer to apply. It indicates a boundary leak where execution logic decides which domain handler to execute and when to requeue.
