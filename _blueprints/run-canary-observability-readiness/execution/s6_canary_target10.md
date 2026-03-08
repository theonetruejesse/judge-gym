# S6 Intermediate Canary (`target_count=10`)

Date: 2026-03-04
Deployment: `ownDev` (`rightful-grouse-57`)

## Run

- `run_id`: `kh78184w5yq1qzvevwrvd6fr5h8280je`
- `status`: `completed`
- `target_count`: `10`

## Diagnostics (`packages/lab:getRunDiagnostics`)

- `request_counts.total`: `40`
- `request_counts.error`: `0`
- `artifact_counts`:
  - `samples=10`
  - `rubrics=10`
  - `rubric_critics=10`
  - `scores=10`
  - `score_critics=10`
- Stage rollups: all stages `success=10`, `error=0`, `pending=0`.

## Telemetry (`packages/codex:analyzeProcessTelemetry`)

- `sampled_events`: `58`
- `duplicate_seq_count`: `0`
- `missing_seq_count`: `0`
- `counter_matches_seq_max`: `true`
- `request_stats.duplicate_apply_success_total`: `0`
- `job_stats.jobs_finalized_multiple_times`: `0`
- `terminal_stats.terminal_event_name`: `run_completed`
- `terminal_stats.events_after_terminal`: `0`

## Stuck work

- `packages/codex:getStuckWork` (`older_than_ms=120000`): no items.

## Result

- S6 gate **PASS**.
- Intermediate scale shows stable completion without retry explosions or post-terminal trace churn.
