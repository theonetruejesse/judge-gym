# Forensic snapshot and observability minimums

**Confidence:** 0.84

**Sources:**
- `packages/engine/convex/domain/maintenance/codex.ts`
- `packages/engine/convex/packages/lab.ts`
- `docs/live_debug_loop.md`
- `packages/engine/convex/domain/telemetry/events.ts`

**Summary:**
The current observability surfaces are sufficient to capture a credible pre-wipe forensic bundle, but not in one place. `getProcessHealth` exposes bounded process snapshots with stage progress, stuck signals, request-state metadata, terminal and historical error summaries, and external trace references. `getRunSummary` provides expected vs observed stage counts and pause state. `getRunDiagnostics` splits historical failed attempts from terminal failed targets. `listRunScoreTargets` preserves bundle membership. What is missing is a first-class iteration artifact that composes these surfaces into one durable snapshot before run-scoped data is wiped.
