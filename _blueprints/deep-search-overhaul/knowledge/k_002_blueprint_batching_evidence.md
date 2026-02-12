# Batching + Agent-Kit Refactor Blueprint

**Confidence:** 0.8

**Sources:**
- /Users/jesselee/dev/research/judge-gym/_blueprints/blueprint-batching.md

**Summary:**
The batching blueprint proposes replacing agent-kit threading with an explicit I/O ledger: `llm_requests` and `llm_batches` tables, provider adapter workflows, and per-request state transitions. It removes thread dependence, standardizes request/response storage (rawOutput, reasoning, verdictText), and organizes enqueue/submit/poll workflows for provider-side or simulated batching. It also calls for usage tracking to attach to requests instead of threads and for downstream parsing to read from completed request records.
