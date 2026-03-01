# Batch error path creates new requests with same custom_key

**Confidence:** 0.64

**Sources:**
- packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- packages/engine/convex/domain/orchestrator/scheduler.ts

**Summary:**
When a batch result row has an error and attempts remain, `applyBatchResults` patches the existing request to error, then creates a new `llm_request` with the same `custom_key` and requeues it. If the original batch later completes or is re-processed, multiple requests with the same key can call the same apply handler, which will duplicate inserts unless guarded.
