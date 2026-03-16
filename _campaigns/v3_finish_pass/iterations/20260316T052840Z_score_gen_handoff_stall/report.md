# 20260316T052840Z Score Gen Handoff Stall

- Manifest version: `1`
- Launch mode: `full`
- Target count: `30`
- Pause after: `null`
- Dominant failure domain: `stage_reconciliation`
- Scientific validity: `scientifically_unknown`

## Summary

The fresh full V3 rerun did not fail inside `rubric_gen` or `rubric_critic`. The 16 heavy `600`-target families completed `30/30` rubric critics and then stalled with no active transport. The six `120`-target families completed end to end.

The new observability signal confirms the failure class precisely: all 16 heavy families are now flagged as `stage_transition_no_transport`, meaning the current stage is artifact-complete, the next stage has target rows, and no transport was ever enqueued.

## Expected vs Observed

- Expected latest-run rubric artifacts: `660` rubrics and `660` rubric critics.
- Observed latest-run rubric artifacts: `660` rubrics and `660` rubric critics.
- Observed total tables: `1050` rubrics and `1050` rubric critics.
- Interpretation: total-table inflation was residual active-wipe debris, not evidence that the current cohort over-produced artifacts.

- Expected cohort state: `healthy_progressing` or `complete`.
- Observed cohort state: `stalled_unknown`.
- Observed counts: `22` latest runs, `6` completed, `16` running, `0` errors.
- Stuck summary: `16 x stage_transition_no_transport`.

## Representative Live Evidence

- Representative stalled heavy run: `kh7bvq448shq6gdm7qv48hcwws831nmr`
- Live diagnostics showed:
  - `rubrics = 30`
  - `rubric_critics = 30`
  - `sample_score_targets = 600`
  - `scores = 0`
  - `current_stage = rubric_critic`
  - no active transport

This rules out “missing rubric critics” and points instead to a stage-transition rollback between `rubric_critic` and `score_gen`.

## Patch Hypothesis

`reconcileRunStage` was doing too much at the heavy-family handoff. It advanced the run and immediately fanned out `score_gen` request creation in the same mutation. For `600`-target families that handoff was large enough to time out and roll back, which left:

- `rubric_critic` artifacts persisted,
- `sample_score_targets` already materialized,
- `runs.current_stage` and `runs.*_count` stale,
- no score-stage transport.

## Patch Applied

- Stage handoff is now asynchronous and chunked.
- `reconcileRunStage` commits the stage advance first, then schedules `enqueueRunStage`.
- `enqueueRunStage` fans out downstream requests in bounded chunks and self-continues when more targets remain.
- `resumePausedRunFlow` now preserves `start_scheduler=false` through the new async enqueue path.
- `getStuckWork` now reports `stage_transition_no_transport`.
- `getV3CampaignStatus` accepts and reports that new stuck reason.

## Validation

- `bun run validate:convex`
- `cd packages/engine && bun run test -- convex/tests/reliability_guarantees.test.ts convex/tests/run_reconcile.test.ts convex/tests/v3_campaign_control_plane.test.ts`
- Live dev status after deploy now classifies the stalled cohort as `stalled_unknown` with `16 x stage_transition_no_transport`.

## Commit

- Commit hash: `PENDING`

## Next Action

Wipe the stalled cohort, relaunch the full loop, and monitor whether the 16 heavy `600`-target families now cross `rubric_critic -> score_gen` without losing transport.
