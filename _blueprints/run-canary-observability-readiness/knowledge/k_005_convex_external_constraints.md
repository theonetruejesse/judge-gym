# Convex Operational Constraints Relevant To Canary Readiness

**Confidence:** 0.81

**Sources:**
- https://docs.convex.dev/database/advanced/occ
- https://docs.convex.dev/error
- https://docs.convex.dev/functions/actions
- https://docs.convex.dev/scheduling/scheduled-functions
- https://docs.convex.dev/understanding/best-practices
- https://docs.convex.dev/production/state/limits
- https://docs.convex.dev/production/integrations/log-streams/
- https://docs.convex.dev/functions/debugging

**Summary:**
Convex OCC behavior and action semantics directly match observed risks: hot-row write conflicts are expected under contention, actions do not auto-retry, and dangling promises can cause silent partial execution. Scheduler/queue lag and concurrency saturation are first-class signals in Convex observability. For production readiness, dashboard-only logs are insufficient; external log streams and structured alerting should backstop run canaries.
