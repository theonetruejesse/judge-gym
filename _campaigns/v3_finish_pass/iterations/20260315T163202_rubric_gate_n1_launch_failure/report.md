# V3 Finish Pass Iteration 20260315T163202_rubric_gate_n1_launch_failure

- Manifest version: `1`
- Launch mode: `rubric_gate`
- Launch request: `target_count=1`, `pause_after=rubric_critic`, `start_policy=all`, `start_scheduler=true`
- Expected cohort size: `22` experiments
- Observed started runs: `0`
- Run ids launched: none

## Outcome

The canary failed during launch before any run rows were created. The control-plane mutation `packages/codex:startV3Experiments` threw a Convex read-limit error while checking scheduler state:

```text
Too many bytes read in a single function execution (limit: 16777216 bytes)
```

The failure stack localizes to:

```text
isSchedulerScheduled -> scheduler.ts:73
scheduleSchedulerIfNeeded handler -> scheduler.ts:296
startV3Experiments handler -> v3_campaign.ts:398
```

## Cohort State

- Cohort status from `getV3CampaignStatus`: `preflight_clean`
- Scientific validity: `scientifically_unknown`
- Stage distribution after failure:
  - `rubric_gen=0`
  - `rubric_critic=0`
  - `score_gen=0`
  - `score_critic=0`
- Stuck summary: none

## Failure Classification

- Dominant failure domain: `scheduler_kickoff`
- Scientific validity judgment: `scientifically_unknown`
- Safe-heal attempted: `false`

## Patch Hypothesis

`startV3Experiments` is coupled to a scheduler-start path that reads too much scheduler state for this deployment. The minimal likely fix is to make scheduler kickoff constant-cost or avoid repeated scheduling-state scans during campaign launch.

## Validation

- Reset executed successfully with zero rows deleted, confirming a clean preflight state.
- Canary launch failed before run creation.
- Patch applied in `packages/engine/convex/domain/orchestrator/scheduler.ts`.
- `bun run validate:convex` passed.
- Rerun result: `22/22` runs launched and all paused cleanly at `rubric_critic`.
- Final canary status: `complete`
- Final scientific validity: `scientifically_valid`
- Remaining limitation: `packages/codex:startV3Experiments` still emits high read-volume warnings near the Convex limit during launch.
