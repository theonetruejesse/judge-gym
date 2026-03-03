# A5 Evidence: Hybrid Phased Migration for Higher Throughput

## Scope
Compare phased architecture options to migrate judge-gym run orchestration from the current scheduler+workflow design to a higher-throughput design with controlled risk.

## Evidence Claims

### C1. Current orchestration is hybrid already, but bottlenecked by global scans.
- Local evidence:
  - Uses `@convex-dev/workflow` component and custom scheduler loop (`runScheduler`) that scans active batches/jobs and fans out workflow steps. [`packages/engine/convex/domain/orchestrator/scheduler.ts:65`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:65)
  - `listActiveBatches` and `listActiveJobs` call `.collect()` by status, so each tick reads all queued/running rows in those statuses. [`packages/engine/convex/domain/llm_calls/llm_batch_repo.ts:41`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts:41)
  - Workflow manager is configured at `maxParallelism: 25`, creating a hard local cap below component maximums. [`packages/engine/convex/domain/orchestrator/process_workflows.ts:27`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:27)
- External evidence:
  - Convex has read-function limits and execution limits that penalize broad scans and long-running logic (e.g., max execution time, bytes read/document read limits). Source: https://docs.convex.dev/production/state/limits
- Confidence: 0.86

### C2. Stage-advancement logic has scan amplification risk as request volume grows.
- Local evidence:
  - `buildRequestStateIndex` reads all `pending` and all `error` `llm_requests` with `.collect()`, then filters in memory by stage/custom keys. [`packages/engine/convex/domain/runs/run_orchestrator.ts:66`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts:66)
- External evidence:
  - Convex limits include read-size thresholds and hard caps; scan-heavy progression checks increase risk of hitting thresholds under high throughput. Source: https://docs.convex.dev/production/state/limits
- Confidence: 0.9

### C3. Scheduler-only redesign is viable but weakens built-in step semantics and raises migration blast radius.
- External evidence:
  - Scheduled functions are mutation/action calls with delayed execution and at-most-once semantics. Source: https://docs.convex.dev/scheduling/scheduled-functions
  - Convex limits scheduled functions per mutation and pending scheduled-function caps; pure scheduler fan-out can saturate these limits if not partitioned. Sources: https://docs.convex.dev/production/state/limits, https://docs.convex.dev/components/overview
- Inference:
  - Replacing workflow orchestration entirely with scheduler-managed state machines shifts retry/idempotency complexity into application code and increases near-term correctness risk.
- Confidence: 0.74

### C4. Workflow-heavy redesign without queue partitioning is lower migration risk but insufficient for significant throughput headroom.
- Local evidence:
  - Current design already leverages workflow retries/parallelism and explicit lease claims, but polling and progress checks still centralize around global loops/scans. [`packages/engine/convex/domain/orchestrator/process_workflows.ts:27`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:27), [`packages/engine/convex/domain/orchestrator/scheduler.ts:70`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:70)
- External evidence:
  - Workflow/workpool component has practical ceilings (e.g., max parallelism constraints and payload-size constraints for workflow execution args). Sources: https://www.npmjs.com/package/@convex-dev/workpool, https://www.npmjs.com/package/@convex-dev/workflow
- Confidence: 0.78

### C5. Queue/table-driven partitioning + workflow workers is the most practical phased target.
- Local evidence:
  - Existing tables already carry claim/lease-style fields and retry metadata (`poll_claim_owner`, `poll_claim_expires_at`, `attempts`, `next_*_at`) suitable for queue-worker migration without schema reset. [`packages/engine/convex/models/llm_calls.ts:7`](/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/llm_calls.ts:7)
- External evidence:
  - Convex component limits (child components, function handles, pending scheduled functions) imply safer scaling via partitioned workers and bounded fan-out rather than one global orchestration loop. Source: https://docs.convex.dev/components/overview
- Confidence: 0.82

## Option Comparison (Phased Migration Lens)

| Option | Throughput upside | Correctness risk | Migration complexity | Limit-pressure profile | Notes |
|---|---:|---:|---:|---|---|
| Workflow-heavy (incremental tuning only) | Medium | Low | Low | Medium-High (scan/read pressure remains) | Fastest to ship, smallest change |
| Scheduler-only state machine | Medium-High | High | High | Medium-High (scheduled function pressure) | More custom retry/idempotency burden |
| Queue/table workers (no workflow) | High | Medium-High | High | Medium | Better partitioning, but large rewrite |
| Hybrid phased (recommended) | High | Medium-Low | Medium | Low-Medium (if partitioned early) | Delivers gains while preserving current correctness guards |

## Recommended Migration Sequence (Local-Code-Informed)

1. **Phase 0: Instrument and baseline (no behavior change)**
- Add per-tick metrics for scan counts and elapsed time around:
  - `runScheduler` list/read fan-out loops.
  - `RunOrchestrator.buildRequestStateIndex` pending/error scans.
- Goal: create pre-migration SLO baselines.

2. **Phase 1: Index-first query narrowing (minimal schema additions)**
- Add targeted indexes on `llm_requests` for stage/process-scoped retrieval (e.g., by `custom_key + status` variants or parsed stage key columns).
- Replace broad `.withIndex("by_status").collect()` scans in stage progress with bounded indexed lookups.
- Risk mitigation: preserves current orchestration semantics while reducing read pressure.

3. **Phase 2: Partitioned runnable queues (coexist with current workflow)**
- Introduce explicit runnable-queue rows (or equivalent partition keys) for due work (`next_run_at`, `next_poll_at`) grouped by shard.
- Keep existing `processWorkflow` handlers but trigger workers from shard queues instead of global full-status scans.
- Maintain existing lease guards to avoid duplicate execution.

4. **Phase 3: Counter-based stage progression**
- Replace run-stage completion scans with per-run-stage counters updated transactionally at request completion/error.
- `maybeAdvanceRunStage` reads counters rather than scanning request history.
- Cuts hot-path read amplification in high concurrency.

5. **Phase 4: Reduce central scheduler to watchdog**
- Keep one lightweight watchdog scheduler for recovery and orphan handling.
- Primary execution comes from partition workers and due-queue claims.
- This retains operational safety while removing global-scan critical path.

## Key Risks and Controls
- **Risk:** Duplicate processing during mixed old/new triggers.
  - **Control:** Preserve claim/lease ownership checks and idempotent apply paths during overlap period.
- **Risk:** Scheduled-function saturation during fan-out.
  - **Control:** Shard-level rate controls; bounded enqueue per tick; monitor pending scheduled count.
- **Risk:** Counter drift causing bad stage transitions.
  - **Control:** Reconciliation query + invariant checks in background watchdog.
- **Risk:** Payload size breaches for workflow args.
  - **Control:** Keep workflow payloads to IDs/keys; fetch bodies in-step.

## Uncertainties
1. Exact throughput target (requests/sec, concurrent runs) and p95 latency budget are not yet explicit.
2. Unknown current production cardinalities for `llm_requests` by status and per-run fan-out; this affects urgency of Phase 1.
3. Component-level concurrency headroom depends on deployment sizing and live provider rate-limit behavior.
4. Counter-based progression needs a concrete invariant spec across partial-failure and retry cases.

## Sources
- Convex limits: https://docs.convex.dev/production/state/limits
- Convex scheduled functions semantics and guarantees: https://docs.convex.dev/scheduling/scheduled-functions
- Convex components overview and component limits: https://docs.convex.dev/components/overview
- Workpool package limits/options: https://www.npmjs.com/package/@convex-dev/workpool
- Workflow package constraints/options: https://www.npmjs.com/package/@convex-dev/workflow
- Actions (at-most-once semantics context): https://docs.convex.dev/functions/actions
- Local code:
  - /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts
  - /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts
  - /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts
  - /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts
  - /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/llm_calls.ts
  - /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/convex.config.ts
