# Control Contract Needs an Explicit Action Taxonomy

**Confidence:** 0.68

**Sources:**
- https://docs.temporal.io/encyclopedia/workflow-message-passing
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/handling-messages
- https://api-docs.temporal.io/
- https://typescript.temporal.io/api/namespaces/workflow
- https://typescript.temporal.io/api/classes/workflow.CancellationScope

**Summary:**
Temporal gives judge-gym enough message primitives to stop inventing vague control abstractions, but only if the rewrite turns them into a literal action contract. Queries are read-only and cannot block. Signals are asynchronous and operationally cheap, but they do not provide a worker-level acknowledgement or result. Updates are synchronous, tracked, and can be awaited to `Accepted` or `Completed`, which makes them the right primitive for validated or acknowledged control actions, but they are more sensitive to worker availability and deployment/version support.

The practical default is not “Updates everywhere.” It is an action taxonomy. `start` remains a workflow start operation. `set_pause_after`, `pause`, `resume`, and bounded `repair` should be Updates when the operator or agent needs validation, acknowledgement, or a returned result. Signals should remain the cheaper primitive for best-effort nudges. `cancel` should use Temporal workflow cancellation, with cleanup in a non-cancellable scope. `DescribeWorkflowExecution` is the stronger server-side execution read, while Queries are advisory workflow-local state reads when workers are healthy. The rewrite should also carry explicit idempotency rules for each action: Update IDs plus workflow-local dedupe across `continue-as-new`, and explicit command IDs for Signals.
