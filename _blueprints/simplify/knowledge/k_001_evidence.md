# Counts live in scoring_stage config and drive scoring workflows

**Confidence:** 0.78

**Sources:**
- packages/engine/convex/models/core.ts
- packages/engine/convex/domain/experiments/stages/scoring/workflows/experiments_scoring_seed_requests.ts
- packages/engine/convex/domain/experiments/experiments_entrypoints.ts

**Summary:**
The schema defines `sample_count` and `evidence_cap` inside `ScoringStageConfig`, making them required experiment config fields. Scoring seed requests read `experiment.config.scoring_stage.sample_count` to create samples and scores, and evidence binding reads `experiment.config.scoring_stage.evidence_cap` to validate and slice the evidence batch.
