# Telemetry and OCC Hotspots

**Confidence:** 0.92

**Sources:**
- `packages/engine/convex/domain/telemetry/emit.ts`
- `packages/engine/convex/domain/telemetry/events.ts`
- `packages/engine/convex/domain/runs/run_service.ts`
- `packages/engine/convex/domain/orchestrator/scheduler.ts`
- Convex MCP `insights` on dev deployment, 2026-03-09
- Convex MCP `packages/codex:getStuckWork` and `packages/codex:autoHealProcess` dry-run on dev deployment, 2026-03-09

**Summary:**
The strongest live telemetry hotspot remains contention on `process_observability`. The local mirror path writes most process, batch, job, scheduler, and error events into a single row per process, rebuilding and sorting the recent event list on each write. Convex Insights still show this as the dominant OCC cluster, with `recordProcessObservability` responsible for the largest retry count and `applyRequestResult` / `reconcileRunStage` showing secondary contention against the same table.

The scheduler OCC issue is real but narrower. `startScheduler` uses a non-atomic “is anything scheduled?” scan followed by `runAfter(0, runScheduler)`, which plausibly causes duplicate-start contention. The audit supports this interpretation, but it does not prove that the race caused lost work in the current idle state. The important distinction is that the main current risk is telemetry hot-row pressure and observability quality, not a live scheduler outage.
