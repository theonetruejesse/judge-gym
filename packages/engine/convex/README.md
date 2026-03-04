# Engine Convex Backend

Convex backend for judge-gym orchestration, telemetry, and lab control APIs.

## Current Architecture

- Scheduler-driven orchestration for run/window flows.
- Internal actions process queued/running batches and jobs.
- Internal mutations own state transitions and durable table writes.
- `process_request_targets` provides snapshot-backed process health rollups.
- `analyzeProcessTelemetry` provides bounded, paginated trace analysis for route usage and duplicate-event churn.
- Telemetry is written to:
  - `telemetry_events`
  - `telemetry_trace_counters`
  - `telemetry_entity_state`

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
- Debug/ops package API:
  - `packages/codex.ts`

## Operational Notes

- The run/window hot path does not depend on `@convex-dev/workflow`.
- Scheduler dispatch is bounded per tick to avoid fanout explosions.
- Batch poll lease claims prevent duplicate concurrent polls.
- Job request execution is bounded-parallel per job tick via `run_policy.job_request_concurrency`.
- Retry behavior is class-aware:
  - parse/orchestrator-side apply failures are terminal
  - transient provider classes retry up to configured caps
- Synthetic matrix testing is supported via external scripts/reports; runtime fault-injection hooks are not enabled in production code paths.

## Validation

After code changes in this package:

```bash
bun run typecheck
```

Use live debug loop docs for runtime triage and recovery:

- `docs/live_debug_loop.md`
