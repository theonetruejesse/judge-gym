# Package Ownership And Dead Code After Temporal Cutover

**Confidence:** 0.83

**Sources:**
- [packages/engine-convex/convex/platform/providers/provider_services.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/platform/providers/provider_services.ts)
- [packages/engine-convex/convex/platform/providers/openai_batch.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/platform/providers/openai_batch.ts)
- [packages/engine-convex/convex/platform/providers/ai_chat.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/platform/providers/ai_chat.ts)
- [packages/engine-convex/convex/platform/providers/provider_types.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/platform/providers/provider_types.ts)
- [packages/engine-temporal/src/window/model_registry.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/window/model_registry.ts)
- [packages/engine-convex/convex/domain/runs/run_prompts.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/run_prompts.ts)
- [packages/engine-convex/convex/packages/worker.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/packages/worker.ts)
- [packages/engine-temporal/src/run/service.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/run/service.ts)
- [packages/engine-convex/convex/domain/analysis/export.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/analysis/export.ts)
- [packages/engine-convex/convex/packages/analysis.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/packages/analysis.ts)
- [packages/analysis/src/judge_gym/export.py](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/export.py)
- https://docs.convex.dev/functions/actions

**Summary:**
The Temporal cutover left `engine-convex` with two different ownership models in the same package. Provider execution for live runs and windows now happens inside `packages/engine-temporal`, but `engine-convex/convex/platform/providers/*` still contains a full internal-action execution layer for OpenAI batch and chat that no longer appears on the active runtime path. At the same time, Convex still owns model/provider registries used by schemas and worker-facing data contracts, so the platform folder is partly dead and partly authoritative.

Prompt ownership is also split in an awkward way. Window transform prompts are already Temporal-side, but run prompts are still generated inside Convex worker APIs and shipped to the Temporal worker as strings. That keeps prompt reproducibility easy because Convex persists `llm_prompt_templates`, but it means execution-owned prompt code still lives in the data plane package. The same pattern shows up in analysis: the Python package owns analysis logic, but Convex still owns the export/query surface that the Python client consumes. That suggests the right cleanup is not “delete every analysis or provider-facing module from Convex,” but a clearer split between live execution code, shared registries/contracts, and export surfaces that exist only to serve other packages.
