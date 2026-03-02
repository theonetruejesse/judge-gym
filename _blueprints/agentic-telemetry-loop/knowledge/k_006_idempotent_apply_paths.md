# Idempotent Apply Guards Exist

**Confidence:** 0.80

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts:62
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts:96

**Summary:**
Apply handlers already short-circuit when outputs are already present. Instrumenting these branches as explicit telemetry events will make replay/duplicate behavior visible without changing core semantics.
