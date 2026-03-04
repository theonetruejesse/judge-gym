# Retry And Request Row Lifecycle

**Confidence:** 0.86

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts

**Summary:**
Retries are row-additive by design: failed requests are retained and a new pending row is created for retryable cases. This supports forensics and idempotency checks but increases write volume. Attempt caps are enforced in retry branches, while dispatch eligibility is primarily status/time based. Rate-limit deferrals shift next-at timestamps without incrementing attempts, so prolonged throttling can appear as repeated queue churn without consuming retry budget.
