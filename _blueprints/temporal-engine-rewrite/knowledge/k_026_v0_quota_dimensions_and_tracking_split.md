# V0 Should Enforce a Small Quota Enum and Track Richer Usage Separately

**Confidence:** 0.77

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_021_global_rate_limit_strategy.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_022_provider_capability_divergence.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_024_minimal_v0_capability_registry_schema.md
- https://platform.claude.com/docs/en/api/ruby/messages/create
- https://platform.claude.com/docs/en/api/service-tiers
- https://ai.google.dev/gemini-api/docs/quota
- https://ai.google.dev/gemini-api/docs/thinking
- https://platform.openai.com/docs/guides/prompt-caching/prompt-caching%20.pls
- https://platform.openai.com/docs/api-reference/chat/create-chat-completion

**Summary:**
The provider docs justify a split between **enforced quota dimensions** and **tracked usage fields**.

The best v0 normalized quota-dimension enum should support:

1. `requests`
2. `input_tokens`
3. `output_tokens`
4. `total_tokens`
5. `batch_enqueued_input_tokens`

This is slightly larger than the earlier candidate, but it is the smallest honest cross-provider superset:
- Anthropic needs `input_tokens` and `output_tokens`.
- Gemini needs `input_tokens`.
- OpenAI needs `total_tokens`.
- Batch compatibility, when implemented, needs an input/prompt-queue style dimension rather than an output dimension.

For the first rollout, the required implemented subset can stay smaller:

1. `requests`
2. provider-selected interactive token dimensions:
   - `input_tokens`
   - `output_tokens`
   - and/or `total_tokens`
3. optional `batch_enqueued_input_tokens` only when an async batch capability is actually implemented for that provider/model.

The following should stay as first-class tracked usage fields but **not** become independently enforced v0 dimensions:

1. `cached_input_tokens`
2. `thinking_tokens`
3. `service_tier`

Why:
- `cached_input_tokens` matter for analytics and replay, but in practice they are a subcategory of input accounting rather than a separate shared-bucket budget the engine must enforce in v0.
- `thinking_tokens` are provider-divergent and often semantically closer to an output detail or reasoning breakdown than a universally enforced quota dimension.
- `service_tier` affects behavior and reporting, but it is metadata, not a token/request bucket by itself.

The same logic applies to day-level limits like RPD or TPD. They are real provider constraints, but they are better treated as future policy extensions or coarse spend guards, not part of the initial shared-bucket design. The first rewrite needs tight cross-worker burst correctness more than it needs every long-horizon quota dimension.

So the v0 rule is:
- **enforce a small normalized quota enum,**
- **track richer provider usage in the attempt ledger,**
- **let each provider/model declare which subset it actually enforces,**
- and keep the registry extensible enough to add more dimensions later if operations demand it.

The minimal implemented operation-type enum should also stay small:

1. `sync_inference`
2. `structured_extraction`
3. `tool_loop`

An optional `async_batch` operation type can exist as a compatibility hook in the registry and ledger, but it should not be treated as a required v0 implementation surface.
