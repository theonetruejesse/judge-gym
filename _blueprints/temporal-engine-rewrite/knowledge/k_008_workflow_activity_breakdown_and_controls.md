# Workflow/Activity Breakdown and Operator Controls (TS SDK)

**Confidence:** 0.70

**Sources:**
- https://typescript.temporal.io/api/namespaces/workflow
- https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/workflow-message-passing/handling-messages.mdx
- https://typescript.temporal.io/api/classes/workflow.CancellationScope
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/encyclopedia/workflow-message-passing

**Summary:**
For a v0 rewrite, the simplest stable shape is one Workflow per process: `RunWorkflow(runId)` and `WindowWorkflow(windowId)` with bounded parallelism. All I/O lives in Activities: evidence search and ingestion, LLM calls, batch submit/poll, and Convex writes for artifacts and status projections.

In Temporal TypeScript, message handlers have hard constraints: Query handlers must be sync and side-effect-free; Signal and Update handlers can be async but must not let the workflow complete while their async work is in-flight. Handler registration and initialization ordering matters because messages can be delivered before first workflow “main” execution in some cases (e.g., Signal-with-Start, backlog, Continue-As-New), so workflows should initialize first then register handlers.

Control semantics map cleanly to Temporal primitives:
- `pause_after` is stage-boundary logic in the Workflow, settable via Signal or Update.
- `pause/resume` can be cooperative (stop scheduling new Activities) or hard (cancel scopes); that is a policy decision.
- `cancel` should map to Temporal workflow cancellation, with non-cancellable cleanup used to patch Convex status and emit telemetry.

Updates are the better primitive for acknowledged operator actions (validation + result), but they have feature/versioning considerations in the TS ecosystem; Signals + Queries can be enough for a v0 control plane, with a later move to Updates for “receipt” semantics.

