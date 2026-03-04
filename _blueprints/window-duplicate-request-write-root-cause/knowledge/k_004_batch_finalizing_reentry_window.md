# Batch Finalizing Can Re-enter if Lease Expires During Apply

**Confidence:** 0.86

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:28
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:413
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:435
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts:52
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts:103
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts:182

**Summary:**
Batches have lease gating, but `finalizing` shares the same runnable pool. If long apply work exceeds lease duration, another worker may reclaim and execute finalizing path again. This is less relevant for the tested job-only run but is a systemic risk for batch mode and aligns with prior observations of duplicate apply/finalize churn.
