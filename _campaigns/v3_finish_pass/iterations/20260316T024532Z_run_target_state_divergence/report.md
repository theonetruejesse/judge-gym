# 20260316T024532Z Run Target-State Divergence

- Manifest version: `1`
- Launch mode: `full`
- Expected cohort: `22` V3 experiments, `target_count=30`, `pause_after=null`
- Observed cohort: `22` latest runs created, `3` completed light-family runs, `3` light-family runs still progressing, and `10/16` heavy-family runs now scientifically invalid at `rubric_critic`

## Cohort Status

- `campaign_state`: `scientifically_invalid`
- `scientific_validity`: `scientifically_invalid`
- `counts`: `total=22`, `with_latest_run=22`, `running=19`, `completed=3`, `paused=0`, `error=0`, `latest_runs_with_failures=10`
- `stuck_summary`: `stage_waiting_on_exhausted_requests=10`
- Family split:
  - `estimated_total_score_targets=120`: `3` completed, `3` still running, `0` failures
  - `estimated_total_score_targets=600`: `16` running, `10` with failures, `0` completed

## Representative Failure

- Experiment: `v3_b1_gpt_4_1_mini_abstain_true`
- Run ID: `kh77kgeh1sk4ybvp6ckjefqac1831snk`
- Run row says:
  - `rubric_gen_count=30`
  - `rubric_critic_count=30`
  - `score_gen_count=0`
  - `score_critic_count=0`
- Actual data says:
  - all `30` samples have `rubric_id`
  - all `30` samples have `rubric_critic_id`
  - `rubric_critics` table has `30` rows for the run
  - but `process_request_targets` for `rubric_critic` still show `30/30 exhausted` with no `success_request_id`
- Process health therefore reports:
  - `rubric_gen completed=30 failed=0 pending=0`
  - `rubric_critic completed=0 failed=30 pending=0`
  - no active transport
  - terminal error class `timeout`

This is not the earlier pure `29/30` tail-stall. It is a divergence between authoritative stage artifacts and request-target accounting.

## Dominant Failure Domain

- Failure domain: `count_accounting`
- Scientific-validity label: `scientifically_invalid_accounting`

## Failure Interpretation

Two problems are now coupled:

1. `applyRequestResult` still writes to the shared `runs` row in the hot path via per-stage counter increments.
2. `process_request_targets` refresh does not treat existing stage artifacts as authoritative success, so target rows can remain `exhausted` even after the sample has a real rubric critic artifact.

The current Convex logs match that interpretation:

- repeated `reconcileRunStage` timeouts
- repeated `applyRequestResult` OCC conflicts on the `runs` row
- smaller number of `applyRequestResult` OCC conflicts on the `experiments` row

## Safe Heal

- Attempted: `false`
- Reason: the run is already scientifically invalid because the status/accounting layer disagrees with stored artifacts

## Chosen Patch Hypothesis

1. Remove shared run-stage counter increments from the per-request apply hot path.
2. Let reconcile own stage-count synchronization and stage advancement.
3. Update request-target state refresh so existing artifacts force `resolution="succeeded"` for completed run targets.

## Validation Outcome

- Patch not applied yet
- No commit yet
