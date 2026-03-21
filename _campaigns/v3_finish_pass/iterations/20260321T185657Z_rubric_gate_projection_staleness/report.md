# V3 Finish Pass Iteration Report

- Iteration: `20260321T185657Z_rubric_gate_projection_staleness`
- Manifest version: `2`
- Launch mode: `rubric_gate`
- Commit at observation: `bcc8469`
- Scientific validity: `scientifically_unknown`
- Dominant failure domain: `projection_staleness`

## Cohort

- Experiment tags: 18 explicit V3 tags from `_campaigns/v3_finish_pass/manifest.json`
- Expected counts:
  - experiments: `18`
  - target_count per experiment: `30`
  - pause_after: `rubric_critic`
- Observed counts at capture:
  - running: `18`
  - paused: `0`
  - completed: `0`
  - error: `0`

## Observed State

- Campaign state from `packages/codex:getV3CampaignSnapshot`: `stalled_recoverable`
- Temporal readiness:
  - `judge-gym.run`: ready
  - `judge-gym.window`: ready
- Stuck summary:
  - `stale_projection`: `5`
- Notable live behavior:
  - Some runs had advanced real artifact counts in `rubric_gen`
  - At least one run was already in `rubric_critic`
  - The cohort was not dead, but progress visibility had diverged from process projections

## Evidence

- Snapshot file: `snapshot.json`
- Example run inspected directly: `kx78907a7gxk5cy5wvkxzsd03x83bmdf`
  - `rubric_gen` successes observed in diagnostics
  - workflow remained bound and `RUNNING` in Temporal

## Safe-Heal

- Attempted before capture: `false`
- Bounded repair attempted after capture: `true`
- Repair operation: `reproject_snapshot`
- Targeted runs:
  - `kx7dart5dxwm020v9jnw75kjh183b12k`
  - `kx75hk48xs714bnfcyjcybwdy583bm0c`
  - `kx7fff428mv6gyezrxk56hp95s83b7yk`
  - `kx74dx23mqazhydq11t3xhp7rn83a7ey`
  - `kx70nw8c2ey47nhh1nkygfwec183a6wh`

## Hypothesis

The rubric-gate cohort is progressing, but several runs are not refreshing `process_observability` often enough during long `rubric_gen` execution. This creates a false `stalled_recoverable` classification driven by projection lag rather than worker failure, provider failure, or missing workflow binding.

## Validation Outcome

- Pre-heal validation: captured
- Post-heal validation:
  - real run progress improved materially
  - at least one previously stale run refreshed into `rubric_critic`
  - representative run `kx78907a7gxk5cy5wvkxzsd03x83bmdf` reached `rubric_critic` with `rubric_gen` completed `30/30`
  - campaign classification remained `stalled_recoverable` because a different subset of runs still aged into `stale_projection`

## Conclusion

This pass exposed an observability/control bug rather than a proven execution halt. The engine is progressing under rubric-gate load, but `process_observability` freshness is not keeping up consistently enough for the campaign snapshot to remain trustworthy. Per the skill contract, the pass stops here after one bounded safe-heal and should resume only after fixing the projection-freshness classification problem.
