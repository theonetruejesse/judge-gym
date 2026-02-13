# Idempotent LLM request ledger

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/schema.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/llm_calls/llm_requests.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/models/llm_calls.ts

**Summary:**
`llm_requests` are indexed by a stable identity tuple (`stage`, `provider`, `model`, `experiment_id`, `rubric_id`, `sample_id`, `evidence_id`, `request_version`) and `getOrCreateLlmRequestImpl` queries that index before inserting. If an identical request already exists, it returns the existing row (optionally patching in missing prompts). This establishes idempotent request creation across retries unless the caller increments `request_version`.
