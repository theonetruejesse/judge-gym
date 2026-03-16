# Engine Convex Backend

Convex backend for judge-gym orchestration, lightweight local observability, and lab control APIs.

## Current Architecture

- Scheduler-driven orchestration for run/window flows.
- Internal actions process queued/running batches and jobs.
- Internal mutations own state transitions and durable table writes.
- Runs persist requested samples (`target_count`), fully finished samples (`completed_count`), per-stage completed counters, and optional `pause_after`.
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
- Scheduler kickoff relies on the scheduler lock plus debounce guard and avoids scanning Convex `_scheduled_functions` during launch.
- V3 campaign start/resume fan out one scheduled internal mutation per experiment so large cohort launches and bulk resumes do not accumulate run-stage enqueue reads inside a single control-plane call.
- Scheduler requeues due orphaned requests before they require manual heal actions.
- Batch/job lease claims are renewed during long-running workflow sections to reduce duplicate execution after lease expiry.
- Batch submit uses a durable `submitting` state plus provider metadata lookup recovery for unknown-outcome submit failures.
- Batch poll lease claims prevent duplicate concurrent polls.
- Job request execution is bounded-parallel per job tick via `run_policy.job_request_concurrency`.
- Paused V3 cohort runs can be resumed in place through `packages/codex:resumeV3Experiments`.
- `packages/codex:startV3Experiments` and `packages/codex:resumeV3Experiments` are asynchronous control-plane entrypoints: they schedule per-run work first, then the per-run task creates or resumes the run and kicks the scheduler.
- `packages/codex:resetRuns` supports `allow_active=true` for explicit destructive wipes of paused/running V3 cohort runs before a fresh pass.
- `packages/codex:resetRuns` is paginated via `cursor` and `max_experiments` so large cohort wipes stay under Convex read limits.
- Run reconciliation now terminalizes exhausted stages instead of leaving scientifically invalid runs in `running` once no pending work remains.
- `packages/codex:getV3CampaignStatus` includes per-experiment score-target estimates plus a workload-family summary so large-fanout families can be monitored separately during V3 passes.
- Run stage progress is stage-local: `rubric_gen` and `rubric_critic` reconciliation do not scan `sample_score_targets`, which keeps early-stage accounting independent of later score-target fanout.
- Request apply/error mutations no longer run full stage reconciliation inline; they update durable counters, and authoritative stage advance/failure still happens when the owning batch/job transport finalizes.
- Retry behavior is class-aware:
  - parse/orchestrator-side apply failures are terminal
  - transient provider classes retry up to configured caps
  - timeout classification recognizes both `timeout` and `timed out` style provider/runtime failures
- Local debug loops use `process_request_targets` plus `process_observability`; deep trace history lives in Axiom.
- One-off run metadata repairs go through `packages/codex:backfillRunCompletedCounts` with `dry_run`, `cursor`, and `max_runs`.
- One-off experiment aggregate repairs go through `packages/codex:backfillExperimentTotalCounts` with `dry_run`, `cursor`, and `max_experiments`.
- `bun run telemetry:check` now performs an Axiom ingest smoke test through Convex.

## Validation

After code changes in this package:

```bash
bun run typecheck
```

For V3 campaign execution, use:

- repo skill: `skills/v3-finish-pass/SKILL.md`
- campaign control plane:
  - `_campaigns/v3_finish_pass/manifest.json`
  - `packages/codex:getV3CampaignStatus`
  - `packages/codex:resumeV3Experiments`
  - `packages/codex:resetRuns`
  - `packages/codex:startV3Experiments`
