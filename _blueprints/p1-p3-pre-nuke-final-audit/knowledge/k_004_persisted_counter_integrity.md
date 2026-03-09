# Persisted Counter Integrity

**Confidence:** 0.97

**Sources:**
- `packages/engine/convex/domain/runs/run_progress.ts`
- `packages/engine/convex/domain/runs/sample_progress.ts`
- `packages/engine/convex/domain/runs/experiment_progress.ts`
- `packages/engine/convex/domain/runs/experiments_data.ts`
- Convex MCP one-off readonly query on dev deployment, 2026-03-09 (recomputed sample, run, and experiment aggregates using runtime completion semantics)

**Summary:**
The recent persisted aggregation migration is currently sound on the audited dev dataset. Exact recomputation using the same semantics as `countCompletedSamples` found zero mismatches across `samples.score_count`, `samples.score_critic_count`, `runs.completed_count`, and `experiments.total_count`. This closes the earlier uncertainty that null legacy sample score fields or aggregate backfill drift might be masking a deeper correctness issue.

This result is point-in-time rather than a proof against future drift under higher concurrency, but it is strong enough to remove persisted-counter correctness from the current blocker list. The remaining value in this area is performance validation, not data-integrity debugging.
