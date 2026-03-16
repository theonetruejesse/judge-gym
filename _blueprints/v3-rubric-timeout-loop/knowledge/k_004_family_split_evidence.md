# Completion Split Tracks Experiment Family, Not Proven Score-Stage Causality

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/iterations/20260316T010116Z_rubric_critic_timeout_exhaustion/snapshot.json
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_strategies.ts

**Summary:**
The observed split is real: the only runs that completed are the experiment families whose `score_target_total` resolves to `120` rather than `600`. However, the dominant failure still occurs at `rubric_critic`, before score generation begins for the stuck runs. That means `120 vs 600` is not yet proven as the direct cause. A stronger interpretation is that completion currently tracks experiment family: the successful families are the bundle-size-5 and low-evidence control variants, while the stuck families are single-evidence, 20-evidence-selected variants. This points to a config-family or prompt-complexity correlation upstream of score generation.
