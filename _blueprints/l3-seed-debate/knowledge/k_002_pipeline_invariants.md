# L3 Pipeline Invariants and Hard Constraints

**Confidence:** 0.9

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/evidence_prompts.ts
- /Users/jesselee/dev/research/jg/judge-gym/docs/window_prompt_canary_2026-03-05.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/window_full_article_comparison.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/telemetry_baselines.md

**Summary:**
The current L3 behavior is governed by strict non-expansion, claim-graph preservation, and no inferred additions. Key measurable invariants are: `len(L3)<=len(L2)` hard guard, full retention of material quantities/temporal anchors, preservation of attribution/causal order, no bullet-count expansion on list-form input, and zero duplicate-apply artifacts at transport level. Recent canary findings show length discipline is improved while actor over-abstraction remained the main semantic risk, now addressed by prompt policy updates that preserve causally central actors and temporal anchors.
