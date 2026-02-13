# Domain/platform layout and stage-local workflows

**Confidence:** 0.72

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/experiments/entrypoints.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/experiments/stages/scoring/workflows/seed_requests.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/runs/entrypoints.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/domain/llm_calls/llm_requests.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/platform/utils/batch_adapter_registry.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/platform/providers/openai_batch.ts

**Summary:**
The Convex backend is split into `domain` and `platform`. Domain modules provide public entrypoints for experiments and runs and invoke stage-local workflows (e.g., scoring `seed_requests` uses strategies + prompt building and delegates to `llm_requests.getOrCreate`). The LLM call ledger lives under `domain/llm_calls`. Platform code supplies shared infrastructure like the BatchAdapter registry and provider-specific batch adapters (OpenAI/Anthropic/Gemini stubs). This split is already reflected in the folder structure and file responsibilities.
