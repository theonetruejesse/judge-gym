# Window Fault Injection Snapshot (2026-03-03)

- window_id: `jx7f0xb7mdvrmsf354t2g8cezn828ghv`
- trace_id: `window:jx7f0xb7mdvrmsf354t2g8cezn828ghv`
- spec: `foreign policy`, `USA`, `2026-01-01..2026-01-07`, `model=gpt-4.1`, `evidence_limit=40`
- test mode: temporary 50% post-provider apply fault injection (now removed from code)

## Observed Telemetry (captured before nuke)

- sampled_events: `392`
- duration_ms: `772460`
- request_applied_total: `57`
- request_parse_error events: `39`
- request_requeued_to_job events: `27`
- unique_request_entities: `96`

## Request Row Distribution

- requestRows: `96`
- attemptsEqMax (`>=2`): `27`
- `l1_cleaned:success`: `32`
- `l1_cleaned:error`: `20`
- `l2_neutralized:success`: `25`
- `l2_neutralized:error`: `19`

## Stage Progress at Stall

- `l1_cleaned`: completed `32`, failed `5`, pending `0`, target_total `37`
- `l2_neutralized`: completed `25`, failed `7`, pending `5`, target_total `37`
- process status: `running`
- active transport: none
- scheduler_scheduled: `false`

## Root Cause Identified

Downstream stage advancement considered targets with missing upstream input as pending forever.  
If an evidence failed in `l1_cleaned`, then no `l2` requests existed, and `maybeAdvanceWindowStage` treated that as pending for `l2`, causing deadlock.

## Patch Applied

In `window_service.maybeAdvanceWindowStage`, targets with `config.inputField === null` are now skipped for that stage (not treated as pending).
