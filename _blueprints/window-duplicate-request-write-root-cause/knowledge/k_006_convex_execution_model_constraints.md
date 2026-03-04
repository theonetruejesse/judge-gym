# Convex Scheduling Semantics That Shape Correctness Strategy

**Confidence:** 0.88

**Sources:**
- https://docs.convex.dev/scheduling/scheduled-functions
- https://docs.convex.dev/api/interfaces/server.Scheduler
- https://docs.convex.dev/production/state/limits

**Summary:**
Convex docs state scheduled mutations execute exactly once (with transient retries), while scheduled actions execute at most once (not retried automatically). Scheduling from actions is non-atomic with later action outcomes. These semantics imply application-level idempotency and lease/claim protections are required to prevent duplicate side effects under concurrent scheduler dispatch, especially in action-driven orchestration loops.
