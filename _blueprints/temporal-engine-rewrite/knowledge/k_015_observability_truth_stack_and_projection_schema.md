# Observability Needs a Precedence Order, Not Just a Split

**Confidence:** 0.69

**Sources:**
- https://docs.temporal.io/visibility
- https://docs.temporal.io/search-attribute
- https://docs.temporal.io/encyclopedia/workflow-message-passing
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/self-hosted-guide/monitoring
- https://docs.temporal.io/references/sdk-metrics
- https://axiom.co/docs/send-data/opentelemetry
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/emit.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/events.ts

**Summary:**
The first two passes correctly separated discovery from stronger execution truth, but this pass clarifies the needed precedence order. Visibility and Search Attributes are still the right fleet-discovery layer, but they are not the strong-truth layer for automation. `DescribeWorkflowExecution` is the strongest general server-side execution snapshot in the current evidence set. Update acceptance or completion is the right receipt for specific control actions. Queries are useful for richer workflow-local state, but only when workers are healthy, so they should not outrank Describe in an automated repair loop.

That yields a real truth stack for judge-gym: `Visibility -> Describe -> Update receipt -> Query -> Convex projection -> Axiom deep telemetry/metrics`. The Convex projection should stay intentionally small, much like the current `process_observability` model: process linkage, last milestone/status/stage, last error summary, trace reference, and a capped recent-event buffer. It should remain a UI/agent ergonomics read model, not execution truth. Temporal service and worker metrics should flow through Prometheus/OpenTelemetry Collector into Axiom, so platform health stays separate from per-process execution state.
