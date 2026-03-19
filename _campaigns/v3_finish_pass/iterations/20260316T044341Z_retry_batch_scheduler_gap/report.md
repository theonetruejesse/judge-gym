# 20260316T044341Z Retry Batch Scheduler Gap

- Manifest version: `1`
- Launch mode: `full`
- Expected cohort: `22` V3 experiments, `target_count=30`, `pause_after=null`
- Observed cohort: `22` latest runs created, `6` completed, `16` still marked `running`, but the engine drained down to one queued retry batch and no active scheduler

## Cohort Status

- `campaign_state`: `stalled_recoverable`
- `scientific_validity`: `scientifically_unknown`
- `counts`: `total=22`, `with_latest_run=22`, `running=16`, `completed=6`, `paused=0`, `error=0`, `latest_runs_with_failures=0`
- `stuck_summary`: `scheduler_not_running=1`
- Active transport at snapshot time:
  - `queued_batches=1`
  - `submitting_batches=0`
  - `running_batches=0`
  - `finalizing_batches=0`
  - `queued_jobs=0`
  - `running_jobs=0`
  - `active_scheduler_locks=0`

## Representative Failure

- Representative run: `kh7ad34dgq25ag6qvsawem18s183062w`
- Current stage: `score_gen`
- Live transport state:
  - one queued batch: `jd75nw3qaqv5515qt8sdy50sdd830xdd`
  - `custom_key=run:kh7ad34dgq25ag6qvsawem18s183062w:score_gen`
  - `attempt_index=2`
  - `submission_id=null`
  - `batch_ref=null`
- Batch lineage for that stage:
  - six attempt-1 batches were created
  - five completed successfully
  - one attempt-1 batch failed with `retryable:timeout:Your request timed out.`
  - that failure created the lone queued attempt-2 retry batch
  - after the scheduler drained, nothing restarted it, so the retry batch remained queued indefinitely

## Dominant Failure Domain

- Failure domain: `transport_requeue`
- Scientific-validity label: `scientifically_unknown`

## Failure Interpretation

This is not the earlier `29/30` accounting failure class. The live pass progressed well into `score_gen`, which confirms the previous rubric/accounting fixes materially improved the engine.

The new failure is a scheduler handoff gap:

1. `handleBatchError` creates a retry batch when a batch times out.
2. That retry batch is inserted in `queued` state and requests are reassigned to it.
3. If the scheduler has already drained by then, nothing explicitly restarts it.
4. The engine can therefore end in a false-running state: run rows still say `running`, but transport is idle except for one stranded queued retry batch.

## Safe Heal

- Attempted: `false`
- Reason: the root cause was localized in code and patched directly; this cohort was retained as forensic evidence only

## Chosen Patch Hypothesis

1. Explicitly kick `startScheduler` after retry-created batches are inserted.
2. Teach `packages/codex:getStuckWork` to classify queued-only transport backlog with no scheduler heartbeat as a real stall.

## Validation Outcome

- Patch applied and validated
- Commit: `8b45d613c766bd0351ac45807c9920d73d6bc982`
- Validation:
  - `cd packages/engine && bun run test -- convex/tests/reliability_guarantees.test.ts`
  - `bun run validate:convex`
