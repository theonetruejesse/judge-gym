# Stage-Gated Execution

**Confidence:** 0.86

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts:49
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts:307
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/window_service.ts:192

**Summary:**
Runs and windows both advance through strict stage order with explicit gating and terminal conditions. This gives deterministic logical ordering but not a persistent event history of transitions.
