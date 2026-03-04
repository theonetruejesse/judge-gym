# Live Debug Loop

This runbook standardizes live debugging for run and window orchestration in Convex.

## Architecture assumptions

- Scheduler is the only orchestrator loop.
- The run/window hot path does not use `@convex-dev/workflow` workpool execution.
- Scheduler dispatch is bounded per tick; large backlogs are drained over multiple ticks.
- Batch poll leases are used to avoid duplicate concurrent poll/apply handlers.

## Interfaces

- Convex package APIs in `packages/engine/convex/maintenance/codex.ts`
  - `packages/codex:getProcessHealth`
  - `packages/codex:analyzeProcessTelemetry`
  - `packages/codex:getStuckWork`
  - `packages/codex:tailTrace`
  - `packages/codex:runDebugActions`
  - `packages/codex:autoHealProcess`
- Bun wrapper in `packages/engine/scripts/live_debug.ts`
  - `bun run debug:watch`
  - `bun run debug:stuck`
  - `bun run debug:heal`
  - `bun run debug:tail`
  - `bun run debug:analyze`
- Synthetic matrix runner in `packages/engine/scripts/synthetic_matrix.ts`
  - `bun run debug:matrix`
  - runs low-sample synthetic window/run scenarios
  - captures per-scenario telemetry summaries to `docs/synthetic_matrix_report_2026-03-03.md`

## Typical Flow

1. Watch process health

- Run: `bun run debug:watch --run <run_id>`
- Window: `bun run debug:watch --window <window_id>`

2. Check stuck backlog

- `bun run debug:stuck --older-ms 120000`

3. Analyze trace behavior (route + duplicate churn)

- Run: `bun run debug:analyze --run <run_id>`
- Window: `bun run debug:analyze --window <window_id>`
- Increase sample depth for dense traces: `--max-events 10000`

4. Dry-run remediation

- Run: `bun run debug:heal --run <run_id>`
- Window: `bun run debug:heal --window <window_id>`

5. Apply remediation

- Run: `bun run debug:heal --run <run_id> --apply`
- Window: `bun run debug:heal --window <window_id> --apply`

6. Verify progress

- Continue watch loop and confirm stage pending count decreases.
- Tail trace if needed: `bun run debug:tail --trace run:<run_id>`

## Safe Actions

- `start_scheduler_if_idle`
- `requeue_orphan_request`
- `requeue_retryable_request`
- `release_expired_batch_claim`
- `nudge_batch_poll_now`

## Failure Playbook

### Run data reset safety

- `domain/maintenance/danger:deleteRunData` rejects active runs by default (`start`, `queued`, `running`, `paused`).
- To force deletion of an active run, pass `allow_active=true` explicitly (for emergency recovery only).
- Prefer dry-run first and capture deletion counts before applying.

### Stuck finalizing batch

- Symptom: `finalizing_no_progress`
- Action: dry-run `debug:heal`, then apply.
- Expected: expired claim released and poll nudged.

### Pending orphan request

- Symptom: `pending_request_no_owner`
- Action: dry-run/apply `debug:heal`.
- Expected: request requeued through target registry handler.

### Scheduler dead while work exists

- Symptom: `scheduler_not_running`
- Action: dry-run/apply `debug:heal`.
- Expected: scheduler is re-started once.

### Large backlog but no explosion

- Symptom: pending queue remains non-zero for several ticks.
- Action: continue watch loop and verify pending count trends downward.
- Expected: bounded throughput and stable function-call rate (not unbounded growth).

### Retryable parse/provider error not requeued

- Symptom: error request with attempts below cap and no replacement pending.
- Action: dry-run/apply `debug:heal`.
- Expected: retry request scheduled.

### Parse/apply failures

- Symptom: parse-related failure at apply stage.
- Expected behavior: terminal failure for that request (no infinite retry loop).
- Verify via `getProcessHealth` error summary and trace events.

## Notes

- Start with dry-run in production-like runs.
- If safe actions do not recover progress, inspect `getProcessHealth` stage rollups and trace events before doing maintenance mutations.
- `packages/codex:getProcessHealth` is snapshot-backed (`process_request_targets`) and intended for large run/window fanout in normal watch loops.
- `packages/codex:analyzeProcessTelemetry` paginates trace reads and summarizes:
  - per-stage route usage (`job`/`batch`/`mixed`)
  - request duplicate-apply churn
  - repeated job finalization
  - events emitted after terminal completion
- Legacy caveat: if a process predates snapshots, bounded fallback reconstruction can make non-active-stage error rollups approximate. Use `packages/lab:getRunDiagnostics` + `packages/lab:getTraceEvents` for full historical forensics.
