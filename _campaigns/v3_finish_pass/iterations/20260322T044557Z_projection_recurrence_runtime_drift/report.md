# V3 Finish Pass Iteration Report

- Iteration: `20260322T044557Z_projection_recurrence_runtime_drift`
- Manifest version: `2`
- Launch mode: `full`
- Commit at observation: `d38860a`
- Scientific validity: `scientifically_unknown`
- Dominant failure domain: `projection_staleness`

## Cohort

- Expected counts:
  - experiments: `18`
  - target_count per experiment: `30`
  - pause_after: `null`
- Observed counts at capture:
  - running: `18`
  - paused: `0`
  - completed: `0`
  - error: `0`
- Stage distribution:
  - `rubric_gen`: `0`
  - `rubric_critic`: `14`
  - `score_gen`: `4`
  - `score_critic`: `0`

## Observed State

- Campaign state from `packages/codex:getV3CampaignSnapshot`: `stalled_recoverable`
- Temporal readiness:
  - `judge-gym.run`: ready
  - `judge-gym.window`: ready
- Stuck summary:
  - `stale_projection`: `8`
- Representative stale process:
  - run `kx78g7rf9ppge3tqn5bpqqfmc183cb5r`
  - Convex health still reports current stage `rubric_critic`
  - Temporal workflow is still found and `RUNNING`
  - Temporal snapshot shows `stage="rubric_critic"` with `stageStatus="done"`
  - batch reconciliation for `rubric_critic` is fully completed (`30/30` succeeded)

## Diagnosis

1. This is no longer a one-off stale read.
   - One bounded `reproject_snapshot` heal already temporarily restored the cohort.
   - The same unhealthy classification has now recurred across eight runs.

2. The projection surface is lagging behind real workflow/batch completion.
   - The representative stale run has a completed 30-item `rubric_critic` batch.
   - Temporal shows the stage marked done.
   - The cohort snapshot still flags the run as stale.

3. The runtime is still not the repo's current worker build.
   - Current live deployment was created before commit `d38860a`.
   - `d38860a` is the commit that raised `minBatchSize` from `30` to `35` and included the latest control-plane/batching hardening.
   - The live under-threshold 30-item rubric batches match the old deployment behavior.

## Conclusion

- Under the finish-pass protocol, this pass should stop here rather than spend more heals.
- The smallest real fix is operational, not a new repo patch:
  - redeploy `apps/engine-temporal` from current `HEAD`
  - verify the worker is now on the `d38860a` behavior
  - relaunch from a clean reset after preserving these forensics

## Chosen Patch Hypothesis

- Redeploy the Temporal worker from current `HEAD` so the live runtime matches the repo's `minBatchSize=35` policy and the latest projection/batching hardening.
