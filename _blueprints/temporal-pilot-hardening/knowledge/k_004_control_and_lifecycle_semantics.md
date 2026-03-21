# Control And Lifecycle Semantics (Run/Window)

**Confidence:** 0.76

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/workflows.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/run/service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/window/service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/runtime.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/temporal/temporal_client.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/run_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/packages/lab.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/maintenance/process_debug.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-settings/src/index.ts
- https://api-docs.temporal.io/
- https://deepwiki.com/temporalio/documentation/4.2-workflow-message-passing
- https://community.temporal.io/t/unable-to-understand-how-workflow-signalwithstart-works/9297

## Summary

The new engine already has a coherent control plane shape:

- **Start**: Convex schedules an internal action that calls Temporal `workflow.start(...)`, then binds `{workflow_id, workflow_run_id}` onto the domain row (`runs` or `windows`). See `run_service.startRunExecution` and `lab.startWindowFlow`.
- **Pause-after**:
  - **Runs** support `pause_after` at creation/start and on resume (Convex passes `pauseAfter` into the workflow input; resume path also executes `setPauseAfter` update before executing `resume`).
  - **Windows**: the Temporal workflow supports a `pauseAfter` input, but Convex start path does not expose or pass any `pause_after` value today.
- **Pause-now / Resume**: Temporal workflow defines Updates `pauseNow` and `resume`, but Convex currently only uses `resume` (and `setPauseAfter` for runs). There is no Convex surface for `pauseNow` yet.
- **Repair**:
  - Temporal workflow defines an Update handler `repairBounded`, but it is currently a stub (`repair_not_implemented`).
  - Convex has a best-effort repair surface (`repairProcessExecution` and `autoHealProcess`) that attempts to (re)start or resume execution depending on whether the process is paused and whether it has a bound `workflow_id`.
- **Cancel**: there is no first-class cancel path wired in Convex to call Temporal cancellation.

This is good enough for basic usage, but not enough for a full-scale pilot debugging loop where an agent retries commands and expects consistent acknowledgement and observability.

## Current Semantics (As Implemented)

### Workflow execution model

Both `runWorkflow` and `windowWorkflow` share the same generic workflow loop:

1. Project an initial snapshot (`executionStatus=queued -> running`).
2. For each stage:
   - set `stage` / `stageStatus=running`
   - call a single stage Activity (`runRunStage` or `runWindowStage`)
   - set `stageStatus=done`, append stage history
   - pause if `pauseAfter === stage`
3. On error: mark `executionStatus=failed`, project the snapshot, and throw.

Notable properties:

- **Stage activities are coarse**: one Activity per stage. A failure within the Activity is handled by worker-side per-target error handling (e.g. `markRunStageFailure`, `markWindowStageFailure`), then the stage Activity returns a summary and the workflow advances.
- **Workflow pause state is held in workflow memory** (`paused` boolean), not persisted as a separate durable marker except via snapshot projection.

### Update handlers and snapshot projection

The workflow defines Update handlers for:
- `setPauseAfter`
- `pauseNow`
- `resume`
- `repairBounded` (stub)

However, these Update handlers do not currently call `projectProcessState(...)` immediately. This means:

- An Update is "acknowledged" by returning a snapshot (or a repair result), but the Convex mirror (`process_observability`) may not reflect the control action until the next stage boundary, pause boundary, or workflow loop projection.
- This is acceptable for a human-operated UI, but it is weak for an agent loop that needs "did the pause actually take effect?" with minimal latency.

### Convex surfaces

Convex control surfaces are currently asymmetric:

- **Runs**:
  - start uses Temporal `startRunWorkflow` with `pause_after`
  - resume uses `resumeRunWorkflow` and optionally executes `setPauseAfter` update first
  - the domain `runs` row gets patched to `running` before resuming a paused run
- **Windows**:
  - start uses `startWindowWorkflow` (no pause-after)
  - resume uses `resumeWindowWorkflow`
  - window row itself is not patched to `running` before resume; execution status is primarily owned by the workflow snapshot + worker projections

### Repair surface today

Convex repair is implemented as a best-effort "ensure execution exists and is running":

- if no bound `workflow_id`, start a workflow (via scheduled internal action)
- if paused, call resume path
- otherwise, call resume path as a nudge

This is directionally correct, but it has two gaps for pilot readiness:

- It doesn't separate "start vs resume vs nudge" explicitly as control actions with consistent IDs and receipts.
- It doesn't cover cancellation/abort.

## What Control Contract Should Exist Before A Full Pilot Loop

For a full agentic pilot loop, the control contract needs to be explicit and idempotent.

Minimum viable contract to harden:

1. **Start**: idempotent start per `{process_kind, process_id}` with stable `workflowId = ${kind}:${id}`.
2. **Set pause-after**: acknowledged update, with stable `cmdId` used as the Update request identifier (Update idempotency).
3. **Pause-now**: acknowledged update, with stable `cmdId` and immediate projection.
4. **Resume**: acknowledged update, with stable `cmdId` and immediate projection.
5. **Cancel**: explicit cancel path that triggers Temporal workflow cancellation and writes a matching Convex domain status (`canceled`) and a final projection event.
6. **Repair bounded**:
   - `ensure_workflow_bound` (start if missing)
   - `nudge_resume` (resume if paused or otherwise re-trigger stage boundary)
   - `reproject_snapshot` (force projection for observability freshness)
   - all acknowledged with stable ids

Temporal supports idempotency for message operations via request identifiers (for example `request_id` in protocol-level APIs), and TypeScript supports `signalWithStart` / Update-with-start patterns. That makes it feasible to implement "start or send command" as one operation, which is valuable for agent loops that don’t want to branch on current liveness. (Temporal docs summarize this as "Signal-With-Start" and "Update-With-Start".)

## Window pause_after: Should We Support It?

I think yes, for pilot readiness, but the semantics should be conservative:

- Support `pause_after="collect"` to gate on scrape quality before spending cleaning tokens.
- Support `pause_after="l1_cleaned"` / `l2_neutralized` similarly, but only if the UI/agent can easily resume and if model-specific cleaning variants are planned.

Counterpoint / uncertainty:

- If the window pipeline is going to be restructured into separate raw-collection vs transform processes anyway, adding pause_after to the current monolithic `WindowWorkflow` could be wasted effort. In that case, the better pilot-ready gate is: `collect` produces a durable "raw evidence set" row, and transforms are run as separate, model-specific workflows over that fixed evidence set.

## Concrete Risks / Gaps For Pilot Loop

1. **Update ack vs projection freshness gap**
   - Updates return snapshots, but the Convex mirror may not change immediately, and agent loop may act on stale mirrors.
2. **Idempotency is caller-managed but not enforced end-to-end**
   - Convex uses `cmd:resume:${Date.now()}` etc; retries will generate new cmd IDs and can lead to multiple Update records.
3. **Missing cancel semantics**
   - Without cancel, the agent must rely on "repair" and destructive resets when a cohort becomes scientifically invalid.
4. **RepairBounded not implemented in workflows**
   - The control surface advertises it but currently cannot do anything workflow-local.

## Recommendation

Before running a full-scale pilot loop, harden the control plane as follows:

- Make every mutating control action carry a stable `cmdId` generated by the caller, and wire it as the Temporal Update request id (so retries are deduped).
- Project snapshots during control updates (at least for `pauseNow`, `resume`, and `setPauseAfter`) so the Convex mirror has low-latency confirmation for automation.
- Add explicit cancel.
- Expose window `pause_after` at least for `collect` even if window decomposition is likely; it is a useful gate for early pilot debugging.

