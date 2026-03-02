# Stage Progression and Requeue Logic in Domain Services

**Confidence:** 0.67

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_orchestrator.ts

**Summary:**
`run_service` and `window_service` both embed orchestration behaviors: they advance stages (`maybeAdvanceRunStage` / `maybeAdvanceWindowStage`) and create new LLM jobs in `requeueRunRequest` / `requeueWindowRequest`. This duplicates state-transition logic that also exists in orchestrators (e.g., pending target evaluation in `WindowOrchestrator.listPendingTargets`) and makes domain services responsible for orchestration decisions, blurring boundaries between orchestration and implementation.
