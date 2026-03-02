# Correlation Keys Already Exist

**Confidence:** 0.85

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts:263
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_orchestrator.ts:133
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/target_registry.ts:15

**Summary:**
`custom_key` and process keys (`run:*`, `window:*`) already provide a robust correlation primitive. A telemetry layer should reuse these keys rather than introducing new identifiers everywhere.
