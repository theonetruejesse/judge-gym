# Start Handoff Must Be Chosen Per Flow, Not by One Global Rule

**Confidence:** 0.80

**Sources:**
- https://community.temporal.io/t/what-is-recommended-approach-on-starting-workflow-in-transaction/16248
- https://docs.temporal.io/sending-messages
- https://api-docs.temporal.io/

**Summary:**
There is still no atomic transaction spanning Convex and Temporal, so the correct question is not “how do we make start atomic?” but “which handoff pattern best matches each flow’s product contract.” Temporal’s Workflow ID conflict and reuse policies make starts idempotent on the Temporal side, and `Signal-With-Start` / `Update-With-Start` collapse some existence races, but none of those primitives create cross-system atomicity.

For judge-gym, the right result is a decision matrix. If a Convex row must exist immediately for UI or audit, use create-then-start and explicitly model `row_exists_but_workflow_missing`. If Temporal is the real owner and Convex is only a projection, start-then-project is cleaner and the repair state becomes `workflow_exists_but_row_missing`. If the requirement is “ensure the workflow exists and apply a command,” use `Signal-With-Start` for fire-and-forget or `Update-With-Start` for acknowledged commands, while explicitly modeling `workflow_started_but_update_missing`. Only use a DB-first intent/outbox when the product contract truly requires eventual start even if the caller dies before retrying. This avoids recreating a generalized queue substrate for every flow.
