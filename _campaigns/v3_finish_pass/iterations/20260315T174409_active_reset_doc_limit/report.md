# V3 Finish Pass Iteration 20260315T174409_active_reset_doc_limit

- Manifest version: `1`
- Launch mode: `full`
- Reset request: `dry_run=false`, `allow_active=true`
- Launch request: `target_count=30`, `pause_after=null`, `start_policy=all`, `start_scheduler=true`
- Expected cohort size: `22` experiments
- Observed reset rows: `0`
- Observed started runs: `0`

## Outcome

The fresh full-loop reset failed before any paused rubric-gate runs were deleted. Because the paused cohort remained active, the subsequent `startV3Experiments` request skipped every experiment with `reason=active_run_exists`.

```text
Too many documents read in a single function execution (limit: 32000)
```

Failure stack:

```text
deleteSingleRunData -> danger.ts:115
deleteExperimentRunData -> danger.ts:378
resetRuns -> v3_campaign.ts:283
```

## Cohort State

- Cohort status from `getV3CampaignStatus`: `complete`
- Scientific validity: `scientifically_valid`
- `22/22` latest runs remain paused at `rubric_critic`
- Stuck summary: none

## Failure Classification

- Dominant failure domain: `artifact_apply`
- Scientific validity judgment: `scientifically_valid`
- Safe-heal attempted: `false`

## Patch Hypothesis

`deleteSingleRunData` still performs whole-table reads for `sample_score_target_items`, `llm_batches`, and `llm_jobs`. The minimal fix is to switch those reads to per-run selective indexed queries so active cohort wipes scale with run size rather than total table size.

## Validation

- Pending patch and rerun.
- Commit at failure capture time: `16dc8ff`
