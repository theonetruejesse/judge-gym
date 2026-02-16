# Run summaries recompute counts from samples/scores

**Confidence:** 0.70

**Sources:**
- packages/engine/convex/domain/experiments/experiments_data.ts

**Summary:**
Run summary and experiment summary endpoints compute counts (samples, scores, abstains, critics) by querying the samples/scores tables rather than storing totals on runs, while also reading run_config data for config display.
