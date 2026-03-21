# Runtime Semantics And Pre-Pilot Cleanup

**Confidence:** 0.87

**Sources:**
- [packages/engine-temporal/src/window/service.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/window/service.ts)
- [packages/engine-temporal/src/run/service.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/run/service.ts)
- [packages/engine-temporal/src/workflows.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/workflows.ts)
- [packages/engine-convex/convex/packages/worker.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/packages/worker.ts)
- [packages/engine-convex/convex/domain/runs/run_progress.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/run_progress.ts)
- [packages/engine-convex/convex/domain/runs/experiments_data.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/experiments_data.ts)
- [packages/engine-convex/convex/domain/maintenance/process_debug.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/maintenance/process_debug.ts)
- [packages/engine-convex/convex/domain/telemetry/events.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/telemetry/events.ts)
- https://api-docs.temporal.io/

**Summary:**
The window and run flows are not currently symmetric in failure handling. Windows already implement partial-failure progression: if some evidence items fail a transform stage, later stages simply operate on the surviving items and the workflow only halts when a stage fully fails. Runs do not behave that way. `finalizeRunStage` halts the entire run whenever any target has failed and the stage has no pending work left, which directly contradicts the desired “29 succeed, 1 fail, keep going” semantics.

More importantly, the run model cannot simply loosen that terminal rule without more state. Downstream entities that depend on an upstream success are skipped in `listRunStageInputs`, but they are not marked failed or skipped, so they remain permanently pending in progress accounting. That means true partial-failure progression for runs requires explicit downstream skip/fail propagation, not just a different status threshold. There is also a scale-risk in the Temporal layer: each whole run or window stage is executed inside one activity attempt with a fixed five-minute `startToCloseTimeout`, even though stage activities loop over many sequential provider calls. Finally, some debug/telemetry language still carries queue-era artifacts (`job`, `batch`, `scheduler`) even though the live execution model is now Temporal plus `llm_attempts`, which makes operator reasoning noisier than it needs to be.
