# Scoring seed requests requirements and knobs

**Confidence:** 0.8

**Sources:**
- packages/engine/convex/domain/experiments/stages/scoring/workflows/seed_requests.ts

**Summary:**
Scoring seeding requires a parsed rubric, fails if no evidence exists for the window, and uses sample_count and optional evidence_limit to create samples and scores. It inserts score_gen LLM requests using the experiment's scoring_model_id and includes all evidence content fields for prompt construction.
