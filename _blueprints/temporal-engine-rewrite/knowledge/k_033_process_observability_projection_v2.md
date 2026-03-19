# The Observability Read Model Should Stay Small, Non-Authoritative, and Optimized for Discovery and Triage

**Confidence:** 0.74

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_010_observability_truth_and_control_plane.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_015_observability_truth_stack_and_projection_schema.md
- https://docs.temporal.io/visibility
- https://docs.temporal.io/search-attribute
- https://docs.temporal.io/sending-messages

**Summary:**
The observability question is no longer “should Convex mirror execution at all?” It should, but only as a compact ergonomics read model that is explicitly non-authoritative for repair decisions.

The correct v0 design is:

- Temporal Visibility and Search Attributes for discovery
- Describe and Update receipts for stronger per-execution truth and action acknowledgement
- Queries for richer optional workflow-local state
- Convex `process_observability_v2` for UI and agent ergonomics
- Axiom for deep telemetry and traces

Temporal’s own docs narrow what can live in discovery fields:

- Visibility counts are approximate
- Search Attributes can lag and are not for low-latency/high-throughput business logic
- Search Attributes are unencrypted, so they must not contain sensitive payload data

That means the Convex projection should stay intentionally small:

- identity and workflow linkage
- coarse execution status and stage
- pause state
- minimal progress counters
- short last-error metadata
- freshness fields like `projection_seq` and timestamps
- trace/control correlation ids

It should not become a full execution-event journal.

The key rule for the future agent loop is simple:

- use `process_observability_v2` to shortlist and explain
- use Temporal to confirm and act

That keeps the projection useful without recreating the old orchestrator substrate in Convex.
