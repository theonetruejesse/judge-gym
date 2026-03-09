# Subset Scoring Table Semantics

**Confidence:** 0.95

**Sources:**
- `packages/engine/convex/models/samples.ts`
- `packages/engine/convex/domain/runs/run_repo.ts`
- `packages/engine/convex/domain/runs/run_orchestrator.ts`
- `packages/engine/convex/domain/runs/run_service.ts`
- `packages/engine/convex/domain/runs/run_progress.ts`
- `packages/engine/convex/domain/runs/experiments_data.ts`

**Summary:**
Modern subset-scoring runs intentionally use two layers of artifacts: one `samples` row per sample and one `sample_evidence_scores` row per `(sample, evidence)` pair. The score-stage source of truth is the unit row, not the sample row, whenever `sample_evidence_scores` exist. Score completions patch `sample_evidence_scores.score_id` and `sample_evidence_scores.score_critic_id`; `samples.score_id` and `samples.score_critic_id` are only patched in the legacy no-unit fallback path. That means null sample-level score pointers are expected on current subset runs and should not be treated as failures by themselves.
