# Empirical Baseline: Duplicate Churn Persists Across Re-run

**Confidence:** 0.92

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/docs/telemetry_baselines.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts:1241

**Summary:**
Two matched window runs (same inputs, evidence_limit=10) show nearly identical high duplicate churn. Baseline A had 104 duplicate apply-success events; Baseline B had 101. Both had repeated `job_finalized` counts (21 across 3 jobs) and events after terminal completion (13 and 12). Runtime improved, but duplicate-write pattern persisted, indicating structural re-entry/idempotency issues rather than one-off transient noise.
