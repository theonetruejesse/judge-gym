# The Rewrite Needs a Literal Control Contract With Different Primitives Per Action

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_012_control_contract_and_action_taxonomy.md
- https://docs.temporal.io/encyclopedia/workflow-message-passing
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/handling-messages
- https://community.temporal.io/t/when-a-workflow-is-cancelled-how-is-the-ongoing-execution-handled/62/3
- https://javadoc.io/static/io.temporal/temporal-sdk/1.24.1/io/temporal/activity/ActivityCancellationType.html

**Summary:**
The remaining ambiguity around operator and agent controls should be resolved by a literal action contract, not a vague “Signals versus Updates” principle.

The correct v0 split is:

1. `create_run` / `create_window`
   - Convex-only domain creation
   - immediate DB acknowledgement

2. `start_run` / `start_window`
   - `StartWorkflow` with stable business-keyed workflow ids
   - durable start acknowledgement comes from the service response, not from Visibility

3. `set_pause_after(stage)`
   - `Update`
   - wait for `Accepted` when durable config landing matters
   - use explicit update ids as command idempotency keys

4. `pause_now`
   - `Update`
   - return `Completed` only when workflow state is actually paused
   - define pause as a cooperative “stop scheduling new work” action, not a magical freeze of in-flight Activities

5. `resume`
   - `Update`
   - return `Completed` only when the paused gate is actually lifted

6. `cancel`
   - workflow cancellation, not a custom signal
   - acknowledgement is quick, but full terminal completion remains asynchronous

7. `repair_bounded`
   - `Update`
   - validate the request inside the workflow, reject unsafe operations, and return correlation ids or the accepted repair plan

Signals still have a place, but only as best-effort nudges where acknowledgement and validation do not matter. `Signal-With-Start` may be useful later for fire-and-forget writes, but it should not become the default for the controls judge-gym wants to expose to operators and agents. `Update-With-Start` is also not the right default for these controls because Temporal explicitly warns it is not atomic; it can start a workflow even if the Update is not delivered.

Two corrections matter operationally:

- Update reliability depends on worker availability, so the client must treat “could not reach an accepting worker” as a normal fallback case.
- Immediate pause is only cooperative unless in-flight Activities are explicitly cancellable and heartbeat often enough to receive cancellation promptly.
- If self-hosted Temporal is older or misconfigured enough that Updates are not a reliable baseline, the rewrite needs a degraded mode where state-setting controls fall back to Signals and lose acknowledgement guarantees. That should be treated as a temporary compatibility mode, not the preferred architecture.

So the v0 rule is:

- `StartWorkflow` for start,
- `Update` for acknowledged state changes,
- cancellation for cancel,
- Signals only for cheap best-effort nudges,
- and explicit command ids for every mutating action.
