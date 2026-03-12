# Convex Terminal State Snapshot

**Confidence:** 0.92

**Sources:**
- `packages/lab:listExperiments` on dev deployment
- `packages/codex:getStuckWork` on dev deployment
- Convex one-off queries over `runs` and `process_request_targets`

**Summary:**
The current post-load state is not fully terminal. Convex shows `44` total runs, with `28` in `completed` and `16` still in `running`. `getStuckWork` currently returns no items even though many runs remain in `running` with no active transport. Table-level aggregates show `3718` request-target rows total, with `3280` in `succeeded` and `438` still in `retryable`. The unresolved retryable set is concentrated in `rubric_critic` (`406`) with a smaller tail in `score_gen` and `score_critic` (`16` each). This means the engine is not done, and the current run-state surfaces under-report stranded retryable work.
