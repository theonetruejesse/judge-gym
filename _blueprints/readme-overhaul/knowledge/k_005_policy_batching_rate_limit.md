# Policy-driven batching, retries, and rate limiting

**Confidence:** 0.76

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/models/core.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/llm_calls/workflows/batch_queue_logic.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/llm_calls/workflows/batch_submit.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/llm_calls/workflows/batch_poll.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/llm_calls/workflows/batch_finalize.ts
- /Users/jesselee/dev/research/judge-gym/packages/lab/src/run_policy.ts
- /Users/jesselee/dev/research/judge-gym/packages/lab/src/supervisor.ts

**Summary:**
Run policies (`RunPolicySchema`) define batch sizing, poll cadence, retry limits/backoff, and allowed provider/model sets. The batch queue logic filters queued requests by policy and stage gating, `submitBatch` enforces policy + rate limits before provider submission, `pollBatch` uses the same policy for polling cadence and retry decisions, and `finalizeBatch` caps attempts while updating request status based on parse/provider outcomes. The Lab supervisor applies the same policy locally (via `RUN_POLICY`) when submitting/polling, keeping client behavior synchronized with server-side enforcement.
