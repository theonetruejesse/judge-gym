# Scheduler and Routing Mechanics

**Confidence:** 0.82

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/base.ts:75
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:55
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts:12

**Summary:**
Routing is threshold-based (`batch` vs `job`) and scheduler polling launches async workflows for active queues. This is operationally simple, but causal sequencing across polling cycles is not explicitly materialized.
