# V3 Full Pass Forensics: Tail Progress Timeout

- Iteration: `20260316T014718Z_rubric_tail_progress_timeout`
- Launch mode: `full`
- Manifest version: `1`
- Scientific validity: `scientifically_invalid_accounting`
- Dominant failure domain: `stage_reconciliation`

## Summary

The current full `n=30` dev pass failed in the same visible shape as the prior pass, but the failure is now localized more precisely. The `16` runs that entered error all died in `rubric_critic` at `29/30`, while the `6` runs with smaller score-target footprints advanced into score stages. This is not a UI lag or simple counting bug: each failed run has exactly one terminal exhausted `rubric_critic` target.

The key new signal is tail concentration. In `15/16` failed runs, the exhausted target belongs to sample ordinal `29` (the last sample created for the run). The remaining failed run exhausted sample ordinal `4`. That pattern points to a tail-processing cost issue rather than a deterministic bad sample, parser contract, or rubric generation defect.

## Live Cohort State

- `22/22` experiments have latest runs.
- `16` latest runs are `error` at `rubric_critic`.
- `6` latest runs are still progressing in `score_gen` or `score_critic`.
- `workload_family_summary` split is exact:
  - `estimated_total_score_targets = 120`: `6 running`, `0 with_failures`
  - `estimated_total_score_targets = 600`: `16 error`, `16 with_failures`

## Evidence

### Representative failed run

- Run: `kh729fctezs0wrvjqtcp25h8q1831qsd`
- Stage: `rubric_critic`
- Artifact counts: `30 rubrics`, `29 rubric_critics`, `0 scores`, `0 score_critics`
- Terminal failed target:
  - `custom_key = sample:ks71xbxdrs771m1rwwb6xz5zgx8307sj:rubric_critic`
  - `attempt_count = 3`
  - `error_class = timeout`
  - `error_message = "Your request timed out."`

### Tail clustering

- Failed sample ordinal `29`: `15` runs
- Failed sample ordinal `4`: `1` run

### Failure logs

- Repeated earlier logs in this pass showed timeouts in:
  - `domain/runs/run_service:applyRequestResult`
  - `domain/runs/run_service:handleRequestError`
  - `domain/runs/run_service:reconcileRunStage`
- Current later logs show `applyRequestResult` OCC conflicts on `sample_score_targets`, reinforcing that the apply path is doing more run-wide work than rubric-stage traffic should require.

## Root-Cause Hypothesis

`run_repo.createRun` precreates every `sample_score_target` before the run starts. Later, every rubric-stage success/error/reconcile path calls `maybeAdvanceRunStage`, which calls `getRunStageProgress`, which calls `getRunProgressSnapshot`. That snapshot always reads all `sample_score_targets` for the run, even when the active stage is only `rubric_gen` or `rubric_critic`.

That means a rubric-stage request in a `600`-target run pays score-stage read cost on every apply/error/reconcile. In batch application, this cost compounds across the sequential request loop, so the tail request is disproportionately likely to time out and then exhaust on retries.

## Chosen Patch

Implement a stage-local run progress path so rubric-stage reconciliation reads only samples plus the minimal request-state rows needed for rubric prerequisites/current-stage status. Do not scan `sample_score_targets` before score stages.

## Validation Plan

1. Patch `run_progress.ts` so `getRunStageProgress` is stage-specific.
2. Add regression coverage showing rubric-stage progress does not depend on score-target cardinality.
3. Run `bun run validate:convex` and targeted tests.
4. Commit, reset the cohort, and rerun the full loop.
