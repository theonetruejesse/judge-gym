# enqueueStage creates llm_requests and batches/jobs

**Confidence:** 0.74

**Sources:**
- packages/engine/convex/domain/orchestrator/base.ts
- packages/engine/convex/settings.ts

**Summary:**
`BaseOrchestrator.enqueueStage` collects pending targets, creates one `llm_request` per target, then decides to route to batch or job based on run policy thresholds. For batch routing, it creates an `llm_batch` and assigns request IDs to the batch; otherwise it creates an `llm_job` and assigns requests to the job. The run policy settings (min batch size, fallback count) determine which route is used.
