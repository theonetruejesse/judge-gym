# S5 Canary Run (`target_count=4`)

Date: 2026-03-04
Deployment: `ownDev` (`rightful-grouse-57`)

## Run

- `run_id`: `kh7f6570ejgwjjmfmazvbs6vxh829fdf`
- `status`: `completed`
- `target_count`: `4`

## Diagnostics (`packages/lab:getRunDiagnostics`)

- `request_counts.total`: `16`
- `request_counts.error`: `0`
- Stage rollups:
  - `rubric_gen`: `success=4, error=0, pending=0`
  - `rubric_critic`: `success=4, error=0, pending=0`
  - `score_gen`: `success=4, error=0, pending=0`
  - `score_critic`: `success=4, error=0, pending=0`

## Telemetry (`packages/codex:analyzeProcessTelemetry`)

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

- S5 gate **PASS**.
