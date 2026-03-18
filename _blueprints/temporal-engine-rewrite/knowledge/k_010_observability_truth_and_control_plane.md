# Observability Needs a Split Between Discovery, Strong Truth, and Telemetry

**Confidence:** 0.74

**Sources:**
- https://docs.temporal.io/visibility
- https://docs.temporal.io/search-attribute
- https://docs.temporal.io/encyclopedia/workflow-message-passing
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/references/sdk-metrics
- https://docs.temporal.io/references/cluster-metrics
- https://docs.temporal.io/self-hosted-guide/monitoring
- https://docs.temporal.io/cloud/metrics
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/emit.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/telemetry/events.ts

**Summary:**
Temporal Visibility is the right fleet-discovery layer, not the sole correctness source for automation. Search Attributes are designed for indexed filtering and triage, but Temporal explicitly warns that visibility state can lag and that low-latency business logic should still use workflow state or external state stores. Queries are good for pure reads, Signals for asynchronous nudges, and Updates for acknowledged operator actions. That means an automation-grade agent loop should not mutate live state based on Visibility listings alone.

For judge-gym, the best split is: Temporal Visibility plus Search Attributes for “what exists” and coarse filtering; stronger per-execution inspection and/or a compact Convex read model for automation-grade decisions; and Axiom for deep traces plus Temporal/SDK metrics. The existing `process_observability` concept still makes sense, but only as a projection of Temporal state rather than the source of truth. This preserves a simple debug surface for agents without rebuilding the current scheduler UI in Convex.
