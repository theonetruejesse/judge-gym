# Scheduler starts batch workflows; running batch applies results

**Confidence:** 0.73

**Sources:**
- packages/engine/convex/domain/orchestrator/scheduler.ts
- packages/engine/convex/domain/orchestrator/process_workflows.ts

**Summary:**
`runScheduler` starts queued and running batch workflows each poll when `shouldRunAt` passes, without a lock to prevent overlap. `processRunningBatchWorkflow` polls the provider and, on completion, calls `applyBatchResults` and then marks the batch successful. This means a running batch can be processed multiple times if multiple workflows are started or retried before the batch is finalized.
