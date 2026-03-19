# Control-plane primitives and gaps

**Confidence:** 0.88

**Sources:**
- `packages/engine/convex/packages/lab.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`
- `packages/engine/convex/domain/maintenance/danger.ts`
- `packages/engine/scripts/live_debug.ts`
- `packages/engine/convex/domain/maintenance/v3_experiment_specs.ts`

**Summary:**
The repo already has enough low-level primitives for an autonomous V3 loop to reset run-scoped state, launch individual experiment runs, inspect per-run and per-experiment status, inspect bundle membership, and apply safe recovery. The gap is not raw engine capability; it is the absence of a mission-level control plane. `startExperimentRun` only launches one experiment at a time, status APIs are process-scoped rather than cohort-scoped, and run-scoped wipe is only exposed at per-run or per-experiment granularity. A partial V3 helper exists in `reseedV3Experiments`, but it is stale and hardcodes legacy assumptions, so it is not reliable as the long-term automation source of truth.
