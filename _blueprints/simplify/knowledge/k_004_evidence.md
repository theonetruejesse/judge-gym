# Templates, experiments, and spec signatures are tightly coupled

**Confidence:** 0.72

**Sources:**
- packages/engine/convex/models/configs.ts
- packages/engine/convex/domain/configs/configs_entrypoints.ts
- packages/engine/convex/domain/experiments/experiments_entrypoints.ts
- packages/engine/convex/utils/spec_signature.ts

**Summary:**
Config templates store normalized window + experiment config with a spec signature. initExperiment ensures a template exists and uses the signature to reuse or create experiments; run configs snapshot templates. The signature currently includes scoring_stage fields like sample_count and evidence_cap.
