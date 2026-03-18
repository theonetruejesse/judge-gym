# Multi-Provider Support Requires a Capability Matrix, Not an OpenAI-Shaped Core

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/provider_types.ts
- https://platform.claude.com/docs/en/api/rate-limits
- https://platform.claude.com/docs/en/api/messages/batches/create
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/batch-api
- https://ai.google.dev/gemini-api/docs/caching
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/structured-output
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://platform.openai.com/docs/guides/rate-limits/usage-tiers%3B.iso

**Summary:**
The current repo hard-codes a single provider (`openai`) and a single model registry shape in `provider_types.ts`. That is enough for the current engine, but it is not a durable abstraction for a rewrite that plans to support Anthropic and Gemini.

The official provider docs show real divergence along four axes that matter architecturally:

1. **Quota dimensions differ.**
   - Anthropic measures Messages API limits in RPM, ITPM, and OTPM per model class, with cache-aware accounting and separate Message Batches queue limits.
   - Gemini documents RPM, TPM, and RPD as the default quota dimensions, and notes that some models have IPM or TPD-style variants.
   - OpenAI documents RPM, RPD, TPM, TPD, IPM, and model-specific batch queue limits.
   A portable limiter therefore cannot assume every provider has `requests`, `input_tokens`, and `output_tokens` only.

2. **Caching semantics differ.**
   - OpenAI prompt caching is automatic, prefix-based, and can use `prompt_cache_key`.
   - Anthropic prompt caching is explicit and cache-aware in rate-limit accounting.
   - Gemini offers both implicit and explicit context caching, with explicit caches using a TTL and standard `GenerateContent` limits still applying.
   A portable engine should treat caching as provider capability metadata, not one shared implementation.

3. **Batch semantics differ.**
   - OpenAI, Anthropic, and Gemini all have asynchronous batch surfaces, but they differ in payload shape, idempotency behavior, queue semantics, and file handling.
   - Gemini explicitly says batch job creation is not idempotent.
   - Anthropic batch limits are shared across all models and are expressed in queued batch requests.
   A portable run engine must model batch as an optional provider capability with provider-specific submission and reconciliation rules.

4. **Tool and structured-output surfaces differ.**
   - Gemini documents separate function-calling and structured-output capabilities and supports parallel/compositional function calling on many models.
   - Anthropic's tool use is block-structured inside Messages and has its own cache invalidation and parallel-tool controls.
   A portable engine should not assume one universal "tool call" request shape.

The key architectural conclusion is simple: the rewrite should use a provider capability registry and provider-specific extension points. Core workflow code should consume normalized capabilities and quota dimensions, while the adapter layer handles provider-specific request shapes, caching hints, optional batch formats, and result metadata. The important point for this pass is compatibility, not immediate implementation breadth: batch support should be modeled as a capability the registry can express, not a feature the first rewrite must fully implement for every provider.
