# applyBatchResults -> applyRequestResult inserts without guard

**Confidence:** 0.78

**Sources:**
- packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- packages/engine/convex/domain/runs/run_service.ts
- packages/engine/convex/domain/orchestrator/target_registry.ts

**Summary:**
`applyBatchResults` resolves a handler based on `custom_key` and calls `run_service.applyRequestResult` for each completed result. `applyRequestResult` unconditionally inserts a rubric/rubric_critic/score/score_critic for the given stage, then patches the sample to point to the new output. There is no idempotency guard checking whether the sample already has an output for that stage or whether the request was already applied, so repeated application creates duplicates.
