# Convex Runtime Constraints Reinforce Smaller Terminal Work

**Confidence:** 0.81

**Sources:**
- https://docs.convex.dev/production/state/limits
- https://docs.convex.dev/functions/error-handling/
- https://docs.convex.dev/understanding/best-practices
- https://docs.convex.dev/scheduling/scheduled-functions
- https://docs.convex.dev/database/advanced/occ

**Summary:**
Official Convex documentation reinforces the same remediation class suggested by the local evidence: keep mutation work small, reduce broad reads with indexes, avoid large `.collect()` calls on growing result sets, and prefer granular scheduled mutations for durable internal workflow steps. Queries and mutations have tight execution and transaction limits, while scheduled mutations are retried exactly once semantics and scheduled actions are at-most-once. This supports a fail-fast terminal mutation for exhausted nonterminal stage targets and deferring expensive recomputation to narrower follow-up work if needed.
