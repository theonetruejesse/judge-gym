# Runaway Scheduler Incident Postmortem (Mar 2, 2026)

## Summary

On **March 2, 2026**, a logic bug in the orchestration/scheduler path triggered an unintended runaway loop in the dev deployment. The loop continuously retried/processed work overnight, causing abnormal Convex usage growth.

- Environment: **development only** (`rightful-grouse-57`)
- Production impact: **none**
- Main impact: excessive function calls, DB storage, and DB bandwidth

## Impact

Observed usage during the incident window:

- Function calls: ~2.2M
- Database storage: ~149 GB
- Database bandwidth: ~424–454 GB

Primary operational symptoms:

- Large telemetry event growth
- Repeated scheduler/workflow execution churn
- Runs stalling/hanging in intermediate stages
- Excessive retries beyond intended behavior in some paths

## Root Cause

The incident was multi-causal, with one dominant hotspot:

1. Telemetry contention hotspot (primary)
- `domain/telemetry/events:emitEvent` used a shared per-trace counter row (`telemetry_trace_counters`) for sequence allocation.
- High-concurrency request apply paths contended on the same counter doc.
- This triggered repeated OCC conflicts and retries, amplifying scheduler/workflow churn.

2. Retry/churn amplification
- Under contention/stall conditions, orchestration retries and transport reconciliation loops kept re-entering hot paths.
- This increased writes/reads and prolonged the runaway behavior.

3. Observability gap during escalation
- Prior instrumentation made it hard to quickly isolate the exact contention point while the system was actively churning.

## Why It Was Expensive

- High-frequency retries + repeated reads/writes in hot orchestration paths.
- Telemetry writes in the same transactional envelope as core request handling increased conflict surface.
- Runaway loop duration (overnight) multiplied total bandwidth/storage consumption.

## Fixes Implemented

### 1) Telemetry write-path redesign (critical fix)

- Removed active dependency on per-trace counter mutation for event sequencing.
- `telemetry_events.seq` now uses timestamp-entropy values to preserve sortable ordering without shared-row patch contention.
- Result: append-only telemetry writes without single-doc hotspot.

### 2) Request-level telemetry handling hardening

- Added deferred telemetry emission support in hot request apply/error paths.
- Reduced telemetry-induced transactional contention in request processing.

### 3) Scheduler/orchestration safeguards

- Bounded scheduler dispatch/loop behavior.
- Retry guardrails and safer requeue/recovery paths.
- Active-run deletion protections in maintenance tools (`deleteRunData` requires explicit override for active runs).

### 4) Live-debug/ops tooling upgrades

- Snapshot-backed process health (`process_request_targets`) for scalable diagnostics.
- Safe auto-heal actions and bounded telemetry analysis tooling.
- Updated runbooks/docs for fresh-context incident handling.

## Validation Performed

- Typecheck clean after fixes (`bun run typecheck`).
- Concurrent canary reruns succeeded in progressing stages.
- Failure logs after the fix point no longer showed new `telemetry_trace_counters` OCC conflict bursts.

## Data Remediation

- Affected high-churn tables were cleared in dev.
- Run-specific and telemetry-specific cleanup tooling was used and documented.

## Current Status

- Incident class identified and mitigated.
- The specific telemetry-counter OCC hotspot is resolved in current code.
- Dev environment state has been reset for clean reruns.

## Remaining Risks / Follow-ups

1. Continue canary testing with concurrent runs before large-scale experiments.
2. Monitor remaining OCC classes (for example rate-limit doc contention) under higher load.
3. Keep trace/health dashboards and runbook usage as part of normal operator flow.
4. Treat synthetic fault runs as controlled tests only; keep production defaults at zero fault injection.

## One-Paragraph External Summary

On March 2, 2026, a development-only orchestration bug caused an overnight runaway loop that significantly increased Convex usage. The primary root cause was a telemetry sequencing hotspot that created OCC contention under concurrent request processing, which amplified retry and scheduler churn. The issue has been fixed by removing the shared-counter telemetry write hotspot, adding safer telemetry emission behavior, and strengthening scheduler/retry safeguards and observability. Affected dev data has been cleaned up, and the current system has been validated with post-fix canary runs.
