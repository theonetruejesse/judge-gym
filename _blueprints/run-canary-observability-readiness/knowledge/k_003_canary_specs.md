# Staged Low-Risk Canary Specs

**Confidence:** 0.82

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/package.json
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/live_debug.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/synthetic_matrix.ts

**Summary:**
A practical pre-matrix canary ladder is available now with existing APIs and scripts: (0) API wiring check, (1) `target_count=1` smoke run, (2) `target_count=4` mixed-route run, and (3) recovery-path drill using safe auto-heal actions only. Each stage can be gated by terminal time bounds and churn metrics from `analyzeProcessTelemetry` (`duplicate_apply_success_total`, repeated finalizations, post-terminal events).
