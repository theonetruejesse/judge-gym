# S1 Telemetry Integrity Preflight

Date: 2026-03-04
Deployment: `ownDev` (`rightful-grouse-57`)

Command:

```bash
cd packages/engine
bun run telemetry:check
```

Observed trace:
- `trace_id`: `window:jx7far6q591dcekxegsd175k2n828p2c`
- Events: `51` (`seq 1..51`)
- Time range: `2026-03-04T06:47:33.855Z -> 2026-03-04T06:49:41.424Z`

Integrity checks:
- `sequence_contiguous`: `true`
- `duplicate_seq_count`: `0`
- `missing_seq_count`: `0`
- `counter_next_seq`: `52`
- `counter_matches_max_plus_one`: `true`

Gate checks:
- `started_events_present`: `true`
- `scheduler_kickoff_present`: `true`
- `window_completed_present`: `true`
- `failure_event_count`: `0`
- `duplicate_apply_success_count`: `0`
- `health_ok`: `true`

Result:
- S1 gate **PASS**.
- No telemetry schema/code changes required.
