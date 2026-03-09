# Observability Surface Mismatches

**Confidence:** 0.96

**Sources:**
- `packages/engine/convex/packages/lab.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`
- `packages/engine/convex/domain/telemetry/emit.ts`
- `packages/engine/convex/domain/telemetry/events.ts`
- `packages/engine/convex/domain/llm_calls/llm_request_repo.ts`
- `packages/engine/convex/models/llm_calls.ts`
- Convex MCP live queries on dev deployment, 2026-03-09 (`packages/lab:getRunDiagnostics`, `packages/codex:getProcessHealth`, `process_observability` table, `llm_requests` by run)

**Summary:**
The current operator surfaces do not cleanly separate terminal truth from historical attempt history. A clean completed run (`kh77e0h2fp5pmr9geaf5q9myh982gecn`) still shows two failed requests in `getRunDiagnostics` and still reports `error_summary=[{class:\"unknown\",count:2}]` in `getProcessHealth`, even though terminal artifacts are fully complete (`30/30/300/300`). This is because `getRunDiagnostics` enumerates errored `llm_requests` rows by run, while `getProcessHealth` collapses `process_request_targets` into per-target latest error classes.

The forensic gaps are also concrete. Failed request rows generally retain only `status`, `attempts`, and `last_error`; the raw failed model output is not durably preserved on the request row in the sampled parse-failure cases. The local `process_observability` mirror drops `payload_json` and stores `external_trace_ref` as `null`, while capping history at the last `32` events. As a result, the system usually retains enough information to say that a parse failure happened, but not enough to reconstruct why it happened after the fact without Axiom.
