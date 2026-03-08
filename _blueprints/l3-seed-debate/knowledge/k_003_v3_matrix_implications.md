# L3 Choice and V3 Matrix Interpretability

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_specs.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v1_distribution_exploration.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v2_engine_prototype_testing.md

**Summary:**
In V3, L3 is both an explicit ablation in Tier A1 and the default setting for most other tiers. This improves comparability but increases risk that semantic-level effects are misattributed as model effects outside the A1 slice. A practical gate is required before treating L3 as default baseline: preserve model separation signal, maintain stability, preserve interpretable abstain behavior, avoid rubric-swap direction flips, and avoid increased confound sensitivity vs L2.
