# Observability and the Agent Loop Contract (Temporal + Convex + Axiom)

**Confidence:** 0.72

**Sources:**
- https://docs.temporal.io/visibility
- https://docs.temporal.io/search-attribute
- https://docs.temporal.io/encyclopedia/workflow-message-passing
- https://docs.temporal.io/sending-messages
- https://docs.temporal.io/self-hosted-guide/monitoring
- https://docs.temporal.io/references/sdk-metrics
- https://docs.temporal.io/cloud/metrics
- https://community.temporal.io/t/clarifications-on-archival-and-visibility/5336
- https://github.com/temporalio/temporal/issues/5643

**Summary:**
Temporal Visibility and Search Attributes are good for fleet discovery (“what runs/windows exist, what stage are they in, which look stuck”), but Visibility is not a correctness oracle for automation loops. Temporal explicitly warns Search Attribute updates may lag, and its Count API returns approximate counts.

For an automation-grade agent loop, the safe pattern is:
- use Visibility/Search Attributes for discovery and coarse filtering,
- confirm per-execution truth via stronger calls (workflow describe / workflow query / workflow update receipts) or a deliberately-designed Convex read model,
- use metrics as the platform SLO layer (service + SDK worker metrics) routed into Axiom for alerting and guardrails.

Operator/control actions should use Signals for best-effort nudges and Updates when you need an acknowledged, validated, tracked action. Update-with-Start is useful but non-atomic, so automation must include explicit reconciliation.

Convex should mirror only a compact process read-model for UI convenience and agent speed, not be authoritative for runtime truth. High-cardinality events and deep forensics should remain in Axiom.

