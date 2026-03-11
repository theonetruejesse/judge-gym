# `llm_requests` already behaves like an attempt log

**Confidence:** 0.92

**Sources:**
- `packages/engine/convex/models/llm_calls.ts`
- `packages/engine/convex/domain/llm_calls/llm_request_repo.ts`
- `packages/engine/convex/domain/llm_calls/llm_job_service.ts`
- `packages/engine/convex/domain/llm_calls/llm_batch_service.ts`
- `packages/engine/convex/domain/runs/run_service.ts`

**Summary:**
Each `llm_requests` row represents one durable execution attempt for a single logical `custom_key`. New retries are appended as new rows rather than mutating the original row into the next attempt. The replacement row is created with the next attempt ordinal before that new attempt resolves, which means the table is already functioning as an attempt ledger rather than as a current-state table. This is reinforced by the fact that transport attachment (`job_id`/`batch_id`) and terminal status (`success`/`error`) are patched on individual rows, while later retries create additional rows with the same prompt and `custom_key`.
