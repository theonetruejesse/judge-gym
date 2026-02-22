# LLM services hardwire window applyRequestResult

**Confidence:** 0.72

**Sources:**
- packages/engine/convex/domain/llm_calls/llm_job_service.ts
- packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- packages/engine/convex/domain/orchestrator/scheduler.ts

**Summary:**
Both job and batch services call internal.domain.window.window_service.applyRequestResult to apply outputs, meaning result handling is currently window-specific. The scheduler’s requeueRequest mutation dispatches via target_registry based on custom_key, but there is no parallel registry for success handling.
