# Job Workflow Re-entry Has No Lease/Claim Guard

**Confidence:** 0.95

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:195
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts:206
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:57
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts:118
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_job_repo.ts:72

**Summary:**
Scheduler dispatches running jobs by `next_run_at` and there is no ownership claim equivalent to batch poll claims. `processRunningJobWorkflow` can run concurrently for the same job across scheduler ticks. Since job repo mutations do not enforce owner/status compare-and-set semantics, duplicate workers can finalize and emit terminal job events multiple times.
