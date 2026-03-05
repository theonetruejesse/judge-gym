# L3 Option Set and Tradeoffs

**Confidence:** 0.88

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/evidence_prompts.ts
- /Users/jesselee/dev/research/jg/judge-gym/docs/window_prompt_canary_2026-03-05.md
- /Users/jesselee/dev/research/jg/judge-gym/README.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_specs.md

**Summary:**
Three viable L3 defaults exist: identity-preserving, role-anonymized, and structural-skeleton. For the dual telescope objective (model differences plus institutional/news interpretation), identity-preserving with selective abstraction of non-central identifiers is the best default. Role-anonymized is suitable as a targeted ablation to isolate identity-prior effects, while structural-skeleton is better as a stress-test diagnostic rather than primary run condition.
