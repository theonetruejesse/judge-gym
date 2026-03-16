# Nonterminal Exhaustion Leaves Runs Running

**Confidence:** 0.92

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_progress.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts

**Summary:**
The current `29/30` plateau is not a count-accounting bug. Stage progress is computed from source-of-truth sample fields plus `process_request_targets`, and an exhausted final rubric-critic target is counted as `failed`, not pending. The semantic bug is that `maybeAdvanceRunStage` only terminalizes a run when `completed === 0 && failed > 0`, so a nonterminal stage with `completed > 0`, `failed > 0`, and `hasPending = false` can remain `running` even though the engine already classifies it as stuck via `stage_waiting_on_exhausted_requests`.
