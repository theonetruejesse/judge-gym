# Core consumers need target truth separated from attempt history

**Confidence:** 0.9

**Sources:**
- `packages/engine/convex/domain/runs/run_orchestrator.ts`
- `packages/engine/convex/domain/runs/run_progress.ts`
- `packages/engine/convex/domain/runs/run_service.ts`
- `packages/engine/convex/packages/lab.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`

**Summary:**
Core orchestration mainly needs target-level unresolved state: whether a logical target is pending, retryable, exhausted, or completed through artifact truth. `run_orchestrator`, `run_progress`, and `run_service` do not need full attempt history on the hot path. By contrast, `packages/lab` and `domain/maintenance/codex` currently mix target truth and historical attempt history in the same surfaces, which is why completed runs can still appear to have failures. A cleaner redesign should make target truth the default API and expose attempt history explicitly as a separate view.
