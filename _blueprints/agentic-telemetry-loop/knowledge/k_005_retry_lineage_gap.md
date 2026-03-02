# Retry Lineage Gap

**Confidence:** 0.88

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_service.ts:117
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts:228
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/llm_calls.ts:40

**Summary:**
Retries create new `llm_request` rows with shared `custom_key`, but there is no explicit parent-child lineage field in request schema. This complicates postmortem analysis of retry chains and duplicate symptoms.
