# Telemetry And Debug Surface Coverage

**Confidence:** 0.83

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/events.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/emit.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/live_debug.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts

**Summary:**
Telemetry is structurally strong: per-trace sequence allocation (`telemetry_trace_counters`), append-only events, and entity-latest snapshots (`telemetry_entity_state`). Operationally, `getProcessHealth`, `getStuckWork`, `autoHealProcess`, and `analyzeProcessTelemetry` provide practical diagnosis and low-risk recovery. The main observability weakness is fail-open telemetry emission (`emitTraceEvent` swallows errors), which can hide telemetry write degradation during high contention. A second gap is that health rollups do not explicitly surface when fallback scans are approximate.
