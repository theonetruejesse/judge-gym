# Final-state refactor summary (internal doc)

**Confidence:** 0.55

**Sources:**
- /Users/jesselee/dev/research/judge-gym/_blueprints/deep-search-overhaul/final-state.md

**Summary:**
The internal final-state memo describes the post-refactor architecture: ledger-first LLM batching with `llm_requests → llm_batches → llm_messages`, policy-driven orchestration anchored on `runs.policy`, and a domain/platform split inside `packages/engine/convex` (domain for experiments/runs/llm_calls, platform for providers/rate limits/utils). It also states stage locality under experiments, a clean public export surface in `packages/engine/src/index.ts`, and lab as the orchestration client. This doc is a strong narrative source but should be cross-checked against current code.
