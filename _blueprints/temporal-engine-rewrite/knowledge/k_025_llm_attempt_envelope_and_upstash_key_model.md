# Provider-Portable `llm_attempts` and Upstash Keys Should Share the Same Normalized Vocabulary

**Confidence:** 0.75

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_013_ledger_schema_and_provider_semantics.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_021_global_rate_limit_strategy.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_023_provider_portable_code_architecture.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_024_minimal_v0_capability_registry_schema.md
- https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
- https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
- https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted
- https://platform.openai.com/docs/api-reference/batch/retrieve
- https://platform.claude.com/docs/en/api/ruby/messages/create
- https://platform.claude.com/docs/en/api/service-tiers
- https://ai.google.dev/gemini-api/docs/thinking

**Summary:**
The attempt ledger and the Upstash limiter should not invent separate provider vocabularies. They should both derive from the same normalized capability registry. That is what keeps the engine provider-portable instead of turning `llm_attempts` or Redis keys into an OpenAI-shaped abstraction.

The minimal first-class `llm_attempts` envelope should include:

1. **Identity and idempotency**
   - `attempt_id`
   - `workflow_id`
   - `workflow_run_id`
   - `activity_id`
   - `business_op_key`
   - `idempotency_key`

2. **Domain linkage**
   - `process_kind` (`run` or `window`)
   - `process_id`
   - `sample_id` / `score_target_id` / `evidence_id` as applicable
   - `stage_key`
   - `operation_type` (`sync_inference`, `structured_extraction`, `tool_loop`, optional `async_batch`)

3. **Provider/model identity**
   - `provider_id`
   - `model_id`
   - `provider_model`
   - `capability_version` or registry snapshot reference

4. **Lifecycle and outcome**
   - `status`
   - `started_at`
   - `finished_at`
   - `duration_ms`
   - `error_class`
   - `error_code`
   - `retry_index`

5. **Normalized usage and quota accounting**
   - `input_tokens`
   - `output_tokens`
   - `cached_input_tokens`
   - `thinking_tokens`
   - `service_tier` (nullable, because Anthropic exposes it and others may not)
   - `quota_reservations`
   - `quota_reconciliations`

6. **Repro and payload references**
   - `system_prompt_template_id`
   - `rendered_prompt_hash`
   - `request_blob_ref`
   - `response_blob_ref`
   - `blob_hash`
   - `retention_class`

Everything else should go under `provider_extensions`. Examples:
- OpenAI batch IDs, file IDs, request counts, reasoning-token details
- Anthropic cache creation breakdowns, cache read details, tool-use counts
- Gemini cached-content details, thought summaries, tool-use prompt counts

The Upstash key model should reuse the same normalized dimension IDs from the registry. A good default key form is:

`jg:quota:{env}:{provider_id}:{model_id}:{scope}:{dimension_id}`

Examples:
- `jg:quota:prod:openai:gpt-5.2:interactive:input_tokens`
- `jg:quota:prod:anthropic:claude-sonnet-4:interactive:output_tokens`
- `jg:quota:prod:gemini:gemini-2.5-flash:batch:batch_enqueued_input_tokens`

This design keeps the key space stable even if provider wire fields change, because the provider adapter maps wire usage into normalized ledger fields, and the registry maps normalized fields into enforced quota dimensions.

For Upstash specifically, the architectural recommendation is:
- use token bucket for burst-sensitive per-minute token or request quotas,
- use custom `rate` consumption for token-based dimensions,
- and keep dimension-specific limiter instances keyed by the normalized dimension IDs.

The important design point is not the exact SDK call shape. It is that `llm_attempts`, adapters, and Upstash all share the same normalized vocabulary so provider portability and quota portability stay coupled.
