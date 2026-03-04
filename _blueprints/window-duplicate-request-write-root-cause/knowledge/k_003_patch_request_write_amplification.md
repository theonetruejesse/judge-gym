# patchRequest and Target Snapshot Refresh Cause Write Amplification

**Confidence:** 0.95

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts:150
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts:154
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts:207
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts:208

**Summary:**
`patchRequest` always writes to `llm_requests`, then always recomputes and patches `process_request_targets`. Snapshot updates always mutate `updated_at_ms`, so repeated no-op status patches still incur DB writes. This magnifies overhead when duplicate apply or finalize paths repeatedly patch already-successful rows.
