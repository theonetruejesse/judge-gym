# A3 Evidence: Map-Reduce Counters for Run Stage Progress

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts#L66
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts#L290
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_orchestrator.ts#L364
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_service.ts#L448
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/schema.ts#L21
- https://docs.convex.dev/database/reading-data/indexes/
- https://docs.convex.dev/understanding/best-practices
- https://docs.convex.dev/functions/mutation-functions
- https://stack.convex.dev/no-count

## Evidence Claims

1. Current stage completion checks repeatedly scan request-status partitions, then filter in application code.
- `buildRequestStateIndex` loads all `llm_requests` rows for `status = pending` and `status = error` via `by_status`, then filters by `custom_key` suffix and membership in `customKeys`.
- This repeats in multiple call paths (`getStageProgress`, `listPendingSampleTargets`, `listPendingLegacySampleScoreTargets`, `listPendingSampleEvidenceTargets`).

2. Stage advancement depends on recomputed aggregates after each request update.
- `maybeAdvanceRunStage` calls `orchestrator.getStageProgress` every time request results/errors are applied; progression requires no pending work and then compares completed/failed totals.
- This is functionally correct but cost grows with run size because progress is re-derived, not incrementally maintained.

3. Existing indexes do not provide a direct key for `(run_id, stage, request_state)`.
- `llm_requests` has `by_status`, `by_custom_key`, and `by_custom_key_status`, but no run-scoped stage index.
- Current logic compensates by scanning status buckets and parsing `custom_key` strings.

4. Convex guidance supports denormalized counters for hot aggregate reads.
- Convex best practices explicitly recommend denormalizing values like counts.
- Convex's "No count" guidance recommends caching/incrementing counters instead of repeatedly deriving totals from large collections.

5. Convex mutation semantics are compatible with transactional counter updates.
- Mutations are atomic with serializable isolation; optimistic concurrency control retries on conflicts.
- This supports updating both the target record and stage counters in the same mutation without exposing partially applied state.

6. Index-range reads are expected to scale better than broad status scans.
- Convex index docs warn that non-indexed full scans are expensive; moving stage-progress reads to narrow indexed rows is aligned with platform best practice.

## Hypotheses (Candidate)

- H1: Introduce a `run_stage_counters` table keyed by `(run_id, stage)` with `total`, `completed`, `failed`, `pending`, `retryable`, `exhausted` to make `getStageProgress` O(1) reads.
- H2: Replace request-status rescans with event-style counter mutations on state transitions (`request created`, `request moved to pending`, `request succeeded`, `request exhausted`).
- H3: Keep source-of-truth output IDs (`sample.*_id`, `sample_evidence_scores.*_id`) and use counters as derived orchestration state that can be reconciled.

## Uncertainties

- U1: Conflict rate under high parallel completion (many requests finishing for same `run_id`/`stage`) is unknown; OCC retries may increase on a hot counter doc.
- U2: It is unclear whether one counter doc per `(run_id, stage)` is sufficient, or whether sharding counters (e.g., by partition) is needed for high-throughput runs.
- U3: Backward compatibility for legacy score stages (pre-`sample_evidence_scores`) may require dual-write or fallback recomputation during migration.
- U4: Current failure semantics classify blocked predecessors as `failed`; counter model must preserve this exact behavior or intentionally revise it.

## Practical Direction

Use an incremental counter/state-transition table as the primary stage-progress read model, while preserving sample/score records as canonical outputs. Keep a periodic reconciliation query for drift detection and recovery.
