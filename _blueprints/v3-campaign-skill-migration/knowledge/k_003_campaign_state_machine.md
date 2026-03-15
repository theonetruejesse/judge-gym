# Campaign state-machine requirements

**Confidence:** 0.86

**Sources:**
- `packages/engine/convex/models/_shared.ts`
- `packages/engine/convex/models/experiments.ts`
- `packages/engine/convex/domain/runs/run_service.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`
- `docs/live_debug_loop.md`
- `packages/engine/convex/tests/run_reporting.test.ts`

**Summary:**
The engine already exposes persisted process states such as `start`, `queued`, `running`, `paused`, `completed`, `error`, and `canceled`, and runs now support `pause_after` plus per-stage counters. However, those engine states are not enough for an autonomous V3 loop. The loop also needs campaign-level distinctions such as `healthy_progressing`, `stalled_recoverable`, `stalled_unknown`, `forensics_captured`, and `ready_to_wipe`. Codex surfaces already expose the raw signals needed to make those distinctions (`retryable_no_transport`, `stage_waiting_on_exhausted_requests`, `raw_collection_no_progress`, recoverable stall counts), so the missing piece is campaign-state policy rather than engine-state storage.
