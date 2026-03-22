# N06 Relaunch Gate

## Decision

Go. `v3-finish-pass` may resume from the current `preflight_clean` state.

## Why

- The score-stage preamble timeout family now has a durable continuation boundary on `llm_batch_executions`.
- Local validation passed across Convex, Temporal, and root typecheck.
- The patched worker is deployed on Railway.
- The manifest-scoped V3 cohort is back to `preflight_clean` with `launch_ready = true`.

## Expected Post-Patch Behavior

- `score_gen` should create or restore a batch-preparation record before replaying new attempt-start writes.
- Replay should resume from persisted attempt checkpoints instead of redoing a full attempt-start fanout.
- If batch preparation still fails, the run should record the concrete process error cause rather than only surfacing `Activity task failed`.

## First Stop-And-Patch Signals

- Cohort-wide recurrence of `score_gen` failure before any provider batch is registered.
- `llm_batch_executions` stuck in `preparing` without `attempt_recorded_count` advancing.
- Process surfaces still collapsing the concrete score-stage failure cause to a generic activity error.
- Forced active reset emitting the old late-callback failure family again instead of safe no-op breadcrumbs.
