# Temporal Still Leads, but the Alternatives Need Explicit Rejection Criteria

**Confidence:** 0.56

**Sources:**
- https://docs.temporal.io/workflows
- https://docs.temporal.io/workflow-definition
- https://docs.temporal.io/activities
- https://docs.temporal.io/encyclopedia/workflow-message-passing
- https://docs.temporal.io/self-hosted-guide/visibility
- https://docs.restate.dev/foundations/services
- https://docs.restate.dev/concepts/durable_execution/
- https://docs.restate.dev/services/versioning
- https://docs.restate.dev/server/overview
- https://github.com/restatedev/restate/blob/main/LICENSE
- https://www.inngest.com/docs/learn/how-functions-are-executed
- https://www.inngest.com/docs/learn/versioning
- https://www.inngest.com/docs/self-hosting
- https://github.com/inngest/inngest

**Summary:**
This pass does not overturn Temporal as the leading default, but it does force a cleaner comparison. Temporal remains strongest on long-lived deterministic workflows, rich message semantics, and a first-class server-side execution control plane that lines up well with judge-gym’s desired agent loop. Restate is not a strawman: it offers exactly-once-per-ID workflow execution, durable journal semantics, and immutable deployment versioning that can reduce some replay/versioning complexity. Inngest is also not a strawman: it offers lightweight step-based durable execution, broad runtime flexibility, and simpler self-host ergonomics.

The honest conclusion is narrower than before. Temporal should remain the default only if judge-gym truly values first-class interactive per-process control, rich server-side execution inspection, and long-lived workflow semantics enough to accept self-hosted orchestration and Node-worker constraints. Restate becomes more attractive if immutable deployments and exactly-once keyed execution are the highest priorities and its licensing is acceptable. Inngest becomes more attractive if lightweight step orchestration and quick self-hosting matter more than judge-gym’s current agent-control ambitions. The rewrite blueprint should therefore carry explicit rejection criteria for Restate and Inngest rather than dismissing them by vibe.
