# startExperiment -> startRunFlow -> scheduler

**Confidence:** 0.72

**Sources:**
- packages/engine/convex/packages/lab.ts
- packages/engine/convex/domain/runs/run_service.ts

**Summary:**
The experiment is started via `startExperiment` which calls `run_service.startRunFlow` and then starts the orchestrator scheduler. `startRunFlow` inserts the run and sample rows and enqueues the first stage via `RunOrchestrator.enqueueStage`. This establishes the initial LLM request and orchestration pipeline that later leads to batch processing.
