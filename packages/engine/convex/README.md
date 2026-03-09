# Engine Convex Backend

Convex backend for judge-gym orchestration, lightweight local observability, and lab control APIs.

## Current Architecture

- Scheduler-driven orchestration for run/window flows.
- Internal actions process queued/running batches and jobs.
- Internal mutations own state transitions and durable table writes.
- Runs persist both requested samples (`target_count`) and fully finished samples (`completed_count`).
- Experiments persist `total_count`, the aggregate sum of run `completed_count` values for that experiment.
- Scheduler auto-requeues due orphaned requests on normal ticks.
- `process_request_targets` provides snapshot-backed process health rollups.
- High-volume telemetry is exported best-effort to Axiom from Convex actions.
- Convex keeps only lightweight local observability in:
  - `process_observability`
  - `scheduler_locks`

## Key Modules

- Orchestration:
  - `domain/orchestrator/scheduler.ts`
  - `domain/orchestrator/process_workflows.ts`
  - `domain/orchestrator/base.ts`
- Transport + request lifecycle:
  - `domain/llm_calls/llm_batch_service.ts`
  - `domain/llm_calls/llm_job_service.ts`
  - `domain/llm_calls/llm_request_repo.ts`
- Process domains:
  - `domain/runs/*`
  - `domain/window/*`
- Telemetry / observability:
  - `domain/telemetry/events.ts`
  - `domain/telemetry/emit.ts`
- Debug/ops package API:
  - `packages/codex.ts`

## Operational Notes

- The run/window hot path does not depend on `@convex-dev/workflow`.
- Scheduler dispatch is bounded per tick to avoid fanout explosions.
- Scheduler requeues due orphaned requests before they require manual heal actions.
- Batch/job lease claims are renewed during long-running workflow sections to reduce duplicate execution after lease expiry.
- Batch submit uses a durable `submitting` state plus provider metadata lookup recovery for unknown-outcome submit failures.
- Batch poll lease claims prevent duplicate concurrent polls.
- Job request execution is bounded-parallel per job tick via `run_policy.job_request_concurrency`.
- Retry behavior is class-aware:
  - parse/orchestrator-side apply failures are terminal
  - transient provider classes retry up to configured caps
- Local debug loops use `process_request_targets` plus `process_observability`; deep trace history lives in Axiom.
- One-off run metadata repairs go through `packages/codex:backfillRunCompletedCounts` with `dry_run`, `cursor`, and `max_runs`.
- One-off experiment aggregate repairs go through `packages/codex:backfillExperimentTotalCounts` with `dry_run`, `cursor`, and `max_experiments`.
- `bun run telemetry:check` now performs an Axiom ingest smoke test through Convex.

## Validation

After code changes in this package:

```bash
bun run typecheck
```

Use live debug loop docs for runtime triage and recovery:

- `docs/live_debug_loop.md`
