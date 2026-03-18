# Provider-Portable Maintainability Depends on Layered Adapters, Capability Metadata, and Extension Fields

**Confidence:** 0.74

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/provider_types.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/provider_services.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/openai_batch.ts
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_019_monorepo_package_runtime_split.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_021_global_rate_limit_strategy.md
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/structured-output
- https://platform.claude.com/docs/en/api/rate-limits

**Summary:**
If the Temporal rewrite wants to stay maintainable while adding OpenAI, Anthropic, Gemini, and future providers, the code architecture needs one more boundary beyond the package split: a clean split between generic execution orchestration and provider-specific transport behavior.

The best default is a three-layer execution design inside `engine-temporal`:

1. **Core execution layer**
   - owns workflows, control contract, attempt ledger emission, idempotency policy, and provider-agnostic decision points.
   - operates on generic concepts like `SyncInference`, `AsyncBatch`, `ToolCapable`, `StructuredOutputCapable`, and `QuotaDimensions`.

2. **Capability registry layer**
   - static or versioned metadata per provider/model family.
   - declares capabilities like:
     - `supports_sync`
     - `supports_batch`
     - `supports_tools`
     - `supports_structured_output`
     - `supports_prompt_cache`
     - `quota_dimensions`
     - `batch_submission_shape`
     - `usage_reporting_fields`
   - this is where the engine learns whether a model is batchable, whether output-token reservation makes sense, and what quota keys exist for Upstash.
   - for this pass, `supports_batch` is about architectural compatibility only. It should not force the v0 rewrite to implement every provider's batch flow immediately.

3. **Provider adapter layer**
   - implements provider-specific request/response transforms, polling, usage extraction, and quota reconciliation.
   - examples:
     - OpenAI adapter handles automatic prompt caching, batch file submission, webhook/poll integration, and OpenAI usage fields.
     - Anthropic adapter handles explicit prompt caching, Messages block structure, cache-aware ITPM semantics, and Message Batches.
     - Gemini adapter handles implicit/explicit caching, `GenerateContent`/Batch APIs, and function-calling vs structured-output request shapes.

For maintainability, the core engine should never branch on provider-specific wire details directly. Instead, it should ask the capability registry what is allowed and ask the adapter to perform the operation. The attempt ledger should also keep a stable generic envelope plus a `provider_extensions` payload for provider-specific metadata. That prevents the ledger schema from becoming OpenAI-shaped forever while still preserving replay/debug information.

This also tightens the Upstash design: bucket keys should be derived from normalized quota dimensions exposed by the capability registry, not from hard-coded `requests/input/output` assumptions in core code. In other words, provider portability and rate-limit portability are the same architecture problem.
