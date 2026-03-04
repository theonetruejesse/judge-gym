# Reset Boundaries With Window Preservation

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/danger.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_orchestrator.ts

**Summary:**
Global nuke functions are not compatible with preserving windows. For iterative canaries where windows/evidence should persist, `deleteRunData` is the correct primitive and leaves window/experiment scaffolding intact. `deleteTelemetryAfterEvent` should not be routine reset tooling because it is global-by-time and can delete unrelated traces. A known risk is that `deleteRunData` currently scans whole transport tables before filtering.
