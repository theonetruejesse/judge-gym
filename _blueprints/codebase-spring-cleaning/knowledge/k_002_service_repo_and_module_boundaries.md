# Service, Repo, And Module Boundary Drift

**Confidence:** 0.85

**Sources:**
- [packages/engine-convex/convex/domain/runs/experiments_data.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/experiments_data.ts)
- [packages/engine-convex/convex/domain/runs/experiments_repo.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/experiments_repo.ts)
- [packages/engine-convex/convex/domain/runs/bundle_plan_logic.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/bundle_plan_logic.ts)
- [packages/engine-convex/convex/domain/runs/bundle_plan_repo.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/bundle_plan_repo.ts)
- [packages/engine-convex/convex/domain/runs/run_repo.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/run_repo.ts)
- [packages/engine-convex/convex/packages/lab.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/packages/lab.ts)

**Summary:**
The `domain/runs` package no longer has a clean “repo vs service” boundary. `experiments_data.ts` behaves like a read-service or query model: it aggregates multiple tables, computes derived status and stage counts, and supplies the public Lab endpoints for experiment and run summaries. The name suggests a passive data helper, but the role is active orchestration of read models. `bundle_plan_logic.ts` is the opposite: it is pure algorithmic materialization code with no persistence, so its current name understates that it is the canonical bundle materializer/strategy module rather than generic “logic.”

The bigger problem is mixed responsibility inside the persistence modules. `experiments_repo.ts` still owns pool creation in addition to experiment persistence, while `bundle_plan_repo.ts` mixes persistence with matching, tag derivation, and higher-level business decisions. `run_repo.ts` also embeds fallback bundle-strategy logic when no persisted `bundle_plan_id` exists, so bundle planning is split across the repo, the repo-like bundle-plan module, and the pure materializer. That makes naming drift reflect real ownership drift: aggregate persistence, read models, and business services are currently blended rather than intentionally layered.
