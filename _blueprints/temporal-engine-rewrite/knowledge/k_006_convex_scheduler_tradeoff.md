# Convex Scheduling Guarantees Are Strong but Misaligned With This Workload

**Confidence:** 0.78

**Sources:**
- https://docs.convex.dev/api/interfaces/server.Scheduler?utm_source=openai
- https://docs.convex.dev/scheduling/scheduled-functions?utm_source=openai

**Summary:**
Convex scheduled mutations have strong durability properties, but scheduled actions are at-most-once and not retried. That is a good fit for many application tasks, but judge-gym’s engine is dominated by long-running external I/O and runtime coordination. As a result, the codebase compensates with retries, claims, reconciliation, and custom queue tables.

This does not mean Convex is the wrong product choice overall. It means Convex is a better fit here for the domain store and UI surface than for acting as the full execution substrate for a long-running orchestrator with heavy external side effects.

