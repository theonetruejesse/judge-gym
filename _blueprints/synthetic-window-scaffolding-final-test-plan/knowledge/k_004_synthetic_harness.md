# Synthetic Harness Paths And Existing Test Hooks

**Confidence:** 0.82

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/tests/live_e2e_matrix.test.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/package.json

**Summary:**
Window flow is scriptable through lab APIs, and synthetic evidence insertion already exists as a supported internal mutation. Live tests already use fallback synthetic evidence when scraping yields none. For low sample counts below `min_batch_size`, route selection defaults to jobs; mixed-route behavior requires boundary-sized workloads. Existing debug scripts and codex APIs are sufficient to run repeatable low-cost stress passes.
