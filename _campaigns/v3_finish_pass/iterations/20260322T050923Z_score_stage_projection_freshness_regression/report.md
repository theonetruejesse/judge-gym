# V3 Finish Pass Iteration Report

- Iteration: `20260322T050923Z_score_stage_projection_freshness_regression`
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
  - `rubric_critic`: `10`
  - `score_gen`: `8`
  - `score_critic`: `0`

## Observed State

- Campaign state from `packages/codex:getV3CampaignSnapshot`: `stalled_recoverable`
- Temporal readiness:
  - `judge-gym.run`: ready
  - `judge-gym.window`: ready
  - only the redeployed worker identity is polling
- Stuck summary:
  - `stale_projection`: `16`

## Representative Evidence

- Representative run: `kx77p605g5ybya44jgjnjfctds83djqj`
- `inspectProcessExecution` shows:
  - Temporal workflow found
  - Temporal execution status `RUNNING`
  - workflow snapshot stage `score_gen`
  - workflow snapshot stage status `running`
- Batch reconciliation for `score_gen` shows:
  - one batch
  - status `preparing`
  - `120` attempts started
  - `0` attempts succeeded
  - target counts still pending as expected for early score stage

## Diagnosis

This does not look like a true engine halt.

The corrected worker deployment fixed the earlier policy drift:
- under-threshold 30-item rubric work no longer batches
- the new worker is the only active poller

But the relaunched full pass still degrades to `stalled_recoverable` once score-stage batches begin. The representative run is actively alive in Temporal and has an in-flight `score_gen` batch, yet the campaign snapshot still flags it as stale. That points to an observability blind spot:

- process freshness is tracked through `process_observability`
- batch-backed stages emit heartbeats on lifecycle/status transitions
- long waits with no provider status change can exceed the stale threshold even while the batch/workflow is healthy

## Chosen Patch Hypothesis

- Patch the batch-backed run/window paths so they emit periodic heartbeats during long poll/wait loops, not only on batch lifecycle transitions.
- Goal:
  - preserve `healthy_progressing` during real long-running score batches
  - keep the stale-projection detector meaningful for actual dead workflows
