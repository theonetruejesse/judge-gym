# Cross-System Start Consistency Requires an Explicit Handoff Pattern

**Confidence:** 0.76

**Sources:**
- https://community.temporal.io/t/what-is-recommended-approach-on-starting-workflow-in-transaction/16248
- https://docs.temporal.io/sending-messages
- https://api-docs.temporal.io/
- https://docs.temporal.io/develop/python/error-handling

**Summary:**
There is no true atomic transaction spanning Convex and Temporal. That means the rewrite must stop pretending “Convex row committed and Workflow started” can be one indivisible action. The correct problem is to make the handoff reliable and idempotent. Temporal provides useful primitives here, including Workflow ID conflict/reuse policies, request IDs, Signal-With-Start, and Update-With-Start, but those APIs still do not create atomic cross-system state.

The safest default for judge-gym is to choose one system as the execution owner and make the other a projection. Temporal should own live execution truth. Convex should hold product state plus an idempotent projection of execution state. If the product requires a Convex row before work is considered started, the choices are a DB-first intent/outbox pattern or a With-Start pattern with an explicitly modeled “started but not yet projected” state. Either way, every Convex write triggered from Temporal must be idempotent, and projection correctness must be reasoned about independently from Temporal’s orchestration guarantees.
