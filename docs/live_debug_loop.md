# Live Debug Loop

This runbook standardizes live debugging for run and window orchestration in Convex.

## Architecture assumptions

- Scheduler is the only orchestrator loop.
- The run/window hot path does not use `@convex-dev/workflow` workpool execution.
- Scheduler dispatch is bounded per tick; large backlogs are drained over multiple ticks.
- Scheduler auto-requeues due orphaned requests during normal ticks.
- Batch/job leases are renewed through long-running submit/run/apply sections to reduce duplicate execution after lease expiry.
- Batch poll leases are used to avoid duplicate concurrent poll/apply handlers.
- Full trace history is exported best-effort to Axiom.
- Convex keeps only lightweight local observability for the live loop.

## Interfaces

- Convex package APIs in `packages/engine/convex/maintenance/codex.ts`
  - `packages/codex:getProcessHealth`
  - `packages/codex:analyzeProcessTelemetry`
  - `packages/codex:getStuckWork`
  - `packages/codex:tailTrace`
  - `packages/codex:runDebugActions`
  - `packages/codex:autoHealProcess`
  - `packages/codex:testAxiomIngest`
- Bun wrapper in `packages/engine/scripts/live_debug.ts`
  - `bun run debug:watch`
  - `bun run debug:stuck`
  - `bun run debug:heal`
  - `bun run debug:tail`
  - `bun run debug:analyze`
- Telemetry smoke test in `packages/engine/scripts/check_telemetry.ts`
  - `bun run telemetry:check`

## Typical Flow

1. Watch process health

- Run: `bun run debug:watch --run <run_id>`
- Window: `bun run debug:watch --window <window_id>`

2. Check stuck backlog

- `bun run debug:stuck --older-ms 120000`

3. Inspect local recent milestones

- Run: `bun run debug:tail --run <run_id>`
- Window: `bun run debug:tail --window <window_id>`

4. View local telemetry summary

- Run: `bun run debug:analyze --run <run_id>`
- Window: `bun run debug:analyze --window <window_id>`
- Note: this summarizes the capped local recent-events mirror, not the full external trace.

5. Dry-run remediation

- Run: `bun run debug:heal --run <run_id>`
- Window: `bun run debug:heal --window <window_id>`

6. Apply remediation

- Run: `bun run debug:heal --run <run_id> --apply`
- Window: `bun run debug:heal --window <window_id> --apply`

7. Verify progress

- Continue watch loop and confirm stage pending count decreases.
- Use the `external_trace_ref` from health/tail/analyze to pivot into Axiom for deep forensics.

## Safe Actions

- `start_scheduler_if_idle`
- `requeue_orphan_request`
- `requeue_retryable_request`
- `release_expired_batch_claim`
- `nudge_batch_poll_now`
- `submitting` batches are included in poll nudges and stale-batch detection; an unknown submit outcome should surface as recoverable `batch_missing_ref` work before any manual re-submit.

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
- Expected steady-state: scheduler requeues due orphaned requests automatically.
- Action if still stuck: dry-run/apply `debug:heal`.
- Expected after heal: request requeued through target registry handler.

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
- Verify via `getProcessHealth` error summary and Axiom trace history.

## Notes

- Start with dry-run in production-like runs.
- If safe actions do not recover progress, inspect `getProcessHealth` stage rollups and local recent events before doing maintenance mutations.
- `packages/codex:getProcessHealth` is snapshot-backed (`process_request_targets`) and intended for large run/window fanout in normal watch loops.
- `packages/codex:tailTrace` and `packages/codex:analyzeProcessTelemetry` read the capped local mirror in `process_observability`.
- The local mirror is intentionally small and milestone-oriented; it is not a full event log.
- Use `bun run telemetry:check` after changing Axiom credentials or ingest wiring.
