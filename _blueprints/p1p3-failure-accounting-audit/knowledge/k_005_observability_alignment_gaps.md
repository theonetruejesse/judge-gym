# Observability Alignment Gaps

**Confidence:** 0.85

**Sources:**
- `packages/engine/convex/domain/telemetry/events.ts`
- `packages/engine/convex/domain/telemetry/emit.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`
- Convex MCP one-off queries on `process_observability` and `process_request_targets`
- Axiom MCP dataset/field inspection and run-level queries on `judge-gym`

**Summary:**
The observability stack is directionally useful but not semantically clean. The local `process_observability` mirror is intentionally capped and can only hold a small recent slice, while Axiom holds the fuller trace. `external_trace_ref` is not truly persisted in the local mirror; health surfaces synthesize it on read. `getProcessHealth.error_summary` and `getRunDiagnostics.failed_requests` include historical retry/error history even on ultimately successful runs, which makes them noisy as indicators of terminal failure. Axiom is strong for corroborating run/window stage transitions and partial-success outcomes, but it is not a table-state source of truth and its `request_error` payloads are currently under-instrumented.
