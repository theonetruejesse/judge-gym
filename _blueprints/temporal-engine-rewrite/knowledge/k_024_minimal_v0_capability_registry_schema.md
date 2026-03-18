# The Minimal V0 Capability Registry Should Normalize Identity, Operations, Usage Fields, and Quota Dimensions

**Confidence:** 0.77

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/platform/providers/provider_types.ts
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_022_provider_capability_divergence.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_023_provider_portable_code_architecture.md
- https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
- https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
- https://platform.claude.com/docs/en/api/ruby/messages/create
- https://platform.claude.com/docs/en/api/service-tiers
- https://ai.google.dev/gemini-api/docs/quota
- https://ai.google.dev/gemini-api/docs/thinking
- https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- https://platform.openai.com/docs/guides/prompt-caching/prompt-caching%20.pls

**Summary:**
The current `provider_types.ts` shape is too thin for the rewrite. It knows provider ID, model ID, provider model name, and whether a model is batchable, but it does not describe the differences that actually matter for control flow, ledger normalization, or Upstash quota keys.

The minimal v0 capability registry should stay small but explicit. It should normalize four classes of information:

1. **Identity**
   - `provider_id`
   - `model_id`
   - `provider_model`
   - optional `model_family`
   This is enough to keep stable internal IDs separate from provider wire names.

2. **Operations**
   - `supports_sync_inference`
   - `supports_tools`
   - `supports_structured_output`
   - `supports_prompt_cache`
   - `supports_async_batch`
   These are compatibility flags, not promises to implement every path in v0.

3. **Usage field mapping**
   - a normalized map from engine concepts to provider usage fields:
     - `input_tokens`
     - `output_tokens`
     - `cached_input_tokens`
     - `thinking_tokens`
     - optional `service_tier`
   This matters because Anthropic exposes cache creation/read tokens and service tier in usage, Gemini exposes prompt/candidate/cached/thought token metadata, and OpenAI exposes cached prompt tokens plus reasoning/output breakdowns.

4. **Quota dimensions**
   Each provider/model entry should declare the normalized quota dimensions the engine cares about, for example:
   - `requests`
   - `input_tokens`
   - `output_tokens`
   - `thinking_tokens`
   - `batch_enqueued_tokens`
   Each dimension should at minimum declare:
   - `dimension_id`
   - `scope` (`interactive` or `batch`)
   - `unit` (`requests` or `tokens`)
   - `reservation_mode` (`preflight`, `post_usage`, `preflight_then_reconcile`)
   - `provider_usage_source`

That schema is deliberately small. It does **not** need to store provider wire payload formats, polling endpoints, or tool-call syntax. Those belong in adapters. The registry is there to answer only the questions the core runtime and Upstash key generator need: what operations are allowed, which normalized usage fields exist, and which quota dimensions must be enforced.
