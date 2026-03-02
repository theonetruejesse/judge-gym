# Blueprint: Agentic Telemetry Loop for judge-gym

This blueprint defines a minimal, high-ROI telemetry architecture for the current Convex engine so AI agents can run experiments end-to-end against production code paths, reconstruct execution ordering, and isolate failures quickly.

## 0. Run Metadata
- Run Folder: `_blueprints/agentic-telemetry-loop`
- Question: Build a holistic telemetry proposal grounded in current code architecture and agentic E2E goals.
- Scope: Convex engine orchestration (`runs`, `windows`, `llm_*`), lab APIs, test loop ergonomics.
- Non-goals: Full OTel rollout in this phase; UI redesign; unrelated model/prompt changes.

## 1. Decision Summary
- Primary recommendation: implement an internal append-only `telemetry_events` model now, instrument only orchestration choke points, and use it as the canonical machine-readable run trace.
- Secondary recommendation: keep Convex logs for operational visibility, but do not rely on logs-only for historical causal diagnostics.
- Future option: bridge telemetry to OTel/log-stream backend after internal event schema and query contracts stabilize.

## 2. Grounded Evidence
- Stage-gated ordering is explicit today, but event history is not persisted: `knowledge/k_001_execution_stage_gating.md`, `knowledge/k_003_observability_gap.md`.
- Correlation keys already exist (`custom_key`, process keys), so telemetry can reuse existing routing identifiers: `knowledge/k_004_correlation_keys.md`.
- Retry lineage and mutable status transitions make forensic debugging harder without append-only events: `knowledge/k_005_retry_lineage_gap.md`.
- Production flow APIs and orchestrator tests are already in place for agentic loop execution: `knowledge/k_007_existing_e2e_coverage.md`.
- Full run->analysis automation currently has an export gap: `knowledge/k_008_analysis_loop_gap.md`.
- Convex logs are useful but not enough alone for durable machine-queryable causality: `knowledge/k_009_convex_logs_limits.md`.
- OTel is valuable, but internal-first is lower complexity and faster to value: `knowledge/k_010_otel_tradeoff.md`.

## 3. Null Challenge Outcomes
- `h_A_exec_graph_001`: Passed
- `h_A_tooling_001`: Passed
- `h_A_tooling_002`: Passed
- `h_A_agentic_001`: Mixed

See `null_challenges/` for detailed falsification attempts.

## 4. Implementation Plan

### S1: Define telemetry event taxonomy and schema
- Objective: Create stable, low-cardinality event contracts for orchestration lifecycle.
- Evidence: `knowledge/k_003_observability_gap.md`, `knowledge/k_004_correlation_keys.md`, `knowledge/k_010_otel_tradeoff.md`.
- Actions:
1. Add `telemetry_events` table schema with fields: `ts_ms`, `name`, `status`, `run_id?`, `window_id?`, `request_id?`, `batch_id?`, `job_id?`, `custom_key?`, `stage?`, `attempt?`, `error?`, `attrs_json?`.
2. Add indexes: `by_ts`, `by_name_ts`, `by_run_ts`, `by_window_ts`, `by_request_ts`, `by_custom_key_ts`.
3. Define bounded event set: `orchestrator.enqueue_stage`, `scheduler.tick`, `workflow.start|end`, `request.apply`, `request.retry_scheduled`, `request.final_error`, `request.idempotent_skip`, `stage.advance`, `run.complete|error`, `window.complete|error`.
- Verification criteria:
1. Schema typechecks cleanly.
2. Event names are documented and validated in one place.
3. Querying by `run_id` returns ordered rows for synthetic test data.

### S2: Build minimal telemetry helper layer
- Objective: ensure consistent event writes and optional span-style helpers.
- Evidence: `knowledge/k_004_correlation_keys.md`, `knowledge/k_010_otel_tradeoff.md`.
- Actions:
1. Implement helper: `emitEvent(ctx, event)` and optional `withSpan(ctx, base, fn)`.
2. Normalize field mapping from existing entities (`custom_key`, `request_id`, stage).
3. Keep helper sink internal (Convex table) and abstract output for future OTel bridge.
- Verification criteria:
1. No direct ad-hoc event insertions outside helper in instrumented paths.
2. Helper handles error-safe emission without blocking business logic.

### S3: Instrument orchestration choke points only
- Objective: maximize signal with minimal code churn.
- Evidence: `knowledge/k_001_execution_stage_gating.md`, `knowledge/k_002_scheduler_and_routing.md`, `knowledge/k_006_idempotent_apply_paths.md`.
- Actions:
1. Instrument `BaseOrchestrator.enqueueStage` for request creation and route decisions.
2. Instrument `scheduler.runScheduler` for tick snapshots and scheduling decisions.
3. Instrument workflow handlers and apply paths (`llm_batch_service`, `llm_job_service`, `run_service`, `window_service`) for apply/retry/error/idempotent-skip events.
- Verification criteria:
1. A single run produces complete lifecycle events across all stages.
2. Idempotent skip branches emit explicit events.
3. Retry-created requests are traceable by key and attempt.

### S4: Add trace and lineage query endpoints
- Objective: make telemetry consumable by agents and tests.
- Evidence: `knowledge/k_005_retry_lineage_gap.md`, `knowledge/k_007_existing_e2e_coverage.md`.
- Actions:
1. Add internal query: `getRunTrace(run_id)`.
2. Add internal query: `getWindowTrace(window_id)`.
3. Add internal query: `getRequestLineage(custom_key | request_id)`.
4. Optionally expose summarized public package-level query for lab views.
- Verification criteria:
1. Given `run_id`, query returns ordered causality sequence.
2. Given `request_id`, query shows retries and final outcome.

### S5: Add derived reliability/latency aggregations
- Objective: compute metrics from event stream for triage and trend analysis.
- Evidence: `knowledge/k_002_scheduler_and_routing.md`, `knowledge/k_003_observability_gap.md`.
- Actions:
1. Implement queries to compute retry rate, failure rate, stage durations, end-to-end run latency.
2. Define fixed windows (`last_24h`, `last_7d`) and top error signatures.
3. Keep aggregations query-driven initially (no separate metrics infra yet).
- Verification criteria:
1. Aggregation query returns stable outputs for seeded test runs.
2. Query performance stays acceptable with projected event volume.

### S6: Define agentic run protocol (production path)
- Objective: standardize how agents execute and diagnose runs.
- Evidence: `knowledge/k_007_existing_e2e_coverage.md`, `knowledge/k_008_analysis_loop_gap.md`.
- Actions:
1. Write runbook: start run via `packages/lab` API, poll trace until terminal event, classify failure mode, optionally replay.
2. Define machine-readable failure classes based on event taxonomy.
3. Add temporary workaround path while export bundle is missing.
- Verification criteria:
1. Agent can execute protocol end-to-end in dev for at least one run.
2. Failure classification is deterministic for seeded error scenarios.

### S7: Expand E2E tests to assert telemetry semantics
- Objective: prevent regressions in ordering and failure observability.
- Evidence: `knowledge/k_006_idempotent_apply_paths.md`, `knowledge/k_007_existing_e2e_coverage.md`.
- Actions:
1. Extend existing orchestration tests to assert expected event sequences.
2. Add tests for replay/idempotent skip visibility and retry lineage correctness.
3. Keep most CI tests deterministic with mocks; isolate live-provider checks.
- Verification criteria:
1. Tests fail when event ordering contracts are violated.
2. Duplicate apply scenario records `idempotent_skip` rather than silent pass.

### S8: Optional phase-2 OTel/log-stream bridge
- Objective: enable multi-system observability after internal model matures.
- Evidence: `knowledge/k_009_convex_logs_limits.md`, `knowledge/k_010_otel_tradeoff.md`.
- Actions:
1. Map internal event schema to OTel-friendly attributes.
2. Export via Convex log streams or dedicated bridge action/collector path.
3. Keep internal event table as source of truth for local/CI agent loops.
- Verification criteria:
1. External backend receives correlated events with stable IDs.
2. Internal workflows continue functioning without external sink dependency.

## 5. Acceptance Gates
1. Causality Gate: agent can reconstruct run ordering from telemetry queries alone.
2. Failure Gate: retry/error/idempotent-skip transitions are explicit and queryable.
3. Automation Gate: E2E agent protocol executes against production code paths.
4. Performance Gate: telemetry overhead remains acceptable under expected run volume.

## 6. Risks and Mitigations
- Risk: event volume growth.
  Mitigation: bounded taxonomy, indexed queries, retention policy.
- Risk: async nondeterminism in test ordering.
  Mitigation: assert partial orders/invariants, not brittle exact timestamps.
- Risk: duplicate sources of truth (status tables vs event log).
  Mitigation: status tables remain operational state; event log is forensic history.

## 7. Open Questions
- Should retry lineage also be added to `llm_requests` schema (parent request id), or remain event-only?
- What retention window is needed for incident analysis and research reproducibility?
- When does the team need to cross the threshold into full OTel backend integration?

## 8. External References
- OpenTelemetry signals: https://opentelemetry.io/docs/concepts/signals/
- OpenTelemetry logs data model: https://opentelemetry.io/docs/specs/otel/logs/data-model/
- OpenTelemetry collector: https://opentelemetry.io/docs/collector/
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- Convex dashboard logs: https://docs.convex.dev/dashboard/deployments/logs
- Convex debugging and logs: https://docs.convex.dev/functions/debugging
- Convex log streams: https://docs.convex.dev/production/integrations/log-streams
