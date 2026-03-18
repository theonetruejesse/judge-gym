# Table Ownership Split for a Greenfield Rewrite

**Confidence:** 0.88

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/schema.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/samples.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/experiments.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/models/window.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts
- https://docs.temporal.io/workflows
- https://docs.temporal.io/task-queue

**Summary:**
The cleanest durable-domain tables to keep in Convex are `experiments`, `runs`, `samples`, `rubrics`, `rubric_critics`, `scores`, `score_critics`, `sample_score_targets`, `sample_score_target_items`, `windows`, `evidences`, `pools`, and `pool_evidences`. These are direct product and research artifacts rather than execution scaffolding.

The clearest runtime tables to eliminate are `scheduler_locks`, `llm_jobs`, `llm_batches`, and `process_request_targets`, because they exist to implement scheduling, transport routing, and derived execution status. `llm_requests`, `llm_prompt_templates`, and `process_observability` should be treated as optional audit or read-model tables, not correctness-critical runtime state. The safest cutover path is greenfield for new executions rather than migrating in-flight process state.

