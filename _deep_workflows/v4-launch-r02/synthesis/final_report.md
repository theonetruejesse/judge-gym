# Final Report: V4 Launch R02

## Objective

Instantiate the locked V4 headline matrix with an idempotent control plane, launch the first cross-provider baseline cohort, and define promotion gates for the remaining headline cells.

## Workflow Summary

- Objective class: live_launch
- Operating mode: live_ops_with_validation
- Execution mode: execute_and_monitor

## Findings

- Added idempotent V4 launch surfaces for evidence universes, evidence sets, and experiments through public Convex upsert APIs plus reusable headline bundle scripts.
- Built the first full provider baseline cohort for the locked wave-1 matrix: Gilardi baseline and Zheng baseline across `gpt-4.1`, `gpt-5.2`, `claude-sonnet-4`, and `qwen-current-text-flagship`.
- The full eight-run baseline cohort completed successfully on own-dev + Railway with zero failures and healthy Temporal queue telemetry throughout.
- The first live baseline pass exposed one lineage bug: the Zheng single-turn canary and baseline originally shared the same experiment tag. The launch run still completed, but the baseline reused the canary experiment row and produced a second run on that experiment.
- Hardened the control plane after that discovery by renaming Zheng canary experiment tags and making `apply_bundle` fail fast on experiment-tag conflicts unless they are explicitly allowed.

## Decisions

- Promote the cross-provider baseline cohort as operationally healthy and ready for the next matrix slice.
- Treat experiment-tag uniqueness as part of the launch contract, not an operator convention.
- Carry the current Zheng single-turn GPT-4.1 experiment-row reuse as a recorded limitation of this baseline pass rather than mutating finished live data.

## Validation

- `bun run validate:convex`
- `cd apps/engine-convex && bun run test -- experiments_contract`
- `bun run v4:build:headline`
- `bun run v4:launch:headline --cohort=baseline`
- `bun run v4:launch:headline --cohort=baseline --live --start-run`
- Verified with `packages/lab.js:listExperiments` that all 8 baseline runs reached `completed` with zero failures.
- Verified with `domain/maintenance/codex.js:getTemporalTaskQueueHealth` that the `judge-gym.run` queue remained healthy with no backlog during and after the cohort.
