# Scoring prompt falls back to raw evidence if view missing

**Confidence:** 0.72

**Sources:**
- packages/engine/convex/domain/experiments/stages/scoring/prompts/scoring_prompts.ts
- packages/engine/convex/domain/experiments/strategies/evidence.strategy.ts

**Summary:**
The score prompt resolves the evidence_view to a content field and then uses a fallback to raw_content if that field is undefined, meaning scoring can proceed even if neutralized_content is absent.
