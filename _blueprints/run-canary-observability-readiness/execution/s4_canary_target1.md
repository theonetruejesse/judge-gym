# S4 Canary Run (`target_count=1`)

Date: 2026-03-04
Deployment: `ownDev` (`rightful-grouse-57`)

## Canary run

- Experiment: `j9729t9pjh3vx9wk9e9hkwtyzn829bz5`
- Final validation run: `kh73r8mt2xcnfsw4kwxe6nkpms829dha`
- Result: `status=completed`

## Issue found and fixed during S4

Observed before fix on earlier canary runs:
- `run_completed` could be emitted before trailing transport events (`job_finalized`), producing `events_after_terminal > 0`.

Fix applied:
- `domain/runs/run_service.ts` no longer advances run stage during request apply/error handling.
- Stage advancement remains driven by transport-finalization reconciliation (`reconcileRunStage`) from workflow handlers.
- Request telemetry (`request_applied`/`request_parse_error`) remains emitted at apply point.

## Final telemetry checks (`packages/codex:analyzeProcessTelemetry`)

For `run:kh73r8mt2xcnfsw4kwxe6nkpms829dha`:
- `counter_matches_seq_max`: `true`
- `duplicate_seq_count`: `0`
- `missing_seq_count`: `0`
- `request_stats.duplicate_apply_success_total`: `0`
- `job_stats.jobs_finalized_multiple_times`: `0`
- `terminal_stats.terminal_event_name`: `run_completed`
- `terminal_stats.events_after_terminal`: `0`

## Result

- S4 gate **PASS** after ordering fix.
