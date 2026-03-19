# Upstash V0 Should Use Token Buckets With Explicit Reservation and Reconciliation Rules

**Confidence:** 0.74

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_021_global_rate_limit_strategy.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_024_minimal_v0_capability_registry_schema.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_025_llm_attempt_envelope_and_upstash_key_model.md
- https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
- https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
- https://platform.claude.com/docs/en/api/ruby/messages/create
- https://ai.google.dev/gemini-api/docs/quota
- https://platform.openai.com/docs/api-reference/chat/create-chat-completion

**Summary:**
For v0, Upstash should be treated as the shared quota engine from day one, not as an optional later add-on. That keeps the cross-worker semantics stable and avoids having to rewrite reservation logic after the first rollout.

The default key form should be:

`jg:quota:v1:{env}:{provider_id}:{model_id}:{scope}:{dimension_id}`

Examples:
- `jg:quota:v1:prod:openai:gpt-5.2:interactive:requests`
- `jg:quota:v1:prod:anthropic:claude-sonnet-4:interactive:input_tokens`
- `jg:quota:v1:prod:gemini:gemini-2.5-flash:batch:batch_enqueued_tokens`

The default algorithm should be **token bucket** for every enforced v0 dimension, with custom consume amounts for token-based dimensions.

The v0 reservation/reconciliation policy should be:

1. **`requests`**
   - `reservation_mode = preflight`
   - reserve `1` before the provider call
   - refund only if the request definitively never left the worker process

2. **`input_tokens`**
   - `reservation_mode = preflight_then_reconcile`
   - reserve an estimated effective input-token count before the call
   - reconcile to actual provider-reported input accounting after the call
   - refund surplus reservations, or consume the delta if the estimate was low

3. **`output_tokens`**
   - `reservation_mode = preflight_then_reconcile`
   - reserve the requested output budget (`max_output_tokens`, `max_tokens`, or engine default cap)
   - reconcile to actual provider-reported output usage after the call
   - refund unused reserved tokens after completion

4. **`total_tokens`**
   - `reservation_mode = preflight_then_reconcile`
   - reserve `estimated_input_tokens + reserved_output_budget` before the call
   - reconcile to actual provider-reported token usage after the call
   - use this dimension for providers that enforce one shared token bucket instead of split input/output buckets

5. **`batch_enqueued_input_tokens`**
   - `reservation_mode = preflight_then_reconcile`
   - reserve the estimated queued-token total before submit
   - keep the reservation until submit success/failure or terminal batch accounting is known
   - refund only the portion that is definitively not enqueued or later released by terminal provider outcome

Two important conservative rules:

- If the provider attempt is ambiguous because the network failed after the request may already have been accepted, do **not** eagerly refund. Keep the reservation and mark reconciliation pending until the attempt is resolved through provider correlation IDs or terminal timeout policy.
- `quota_reservations` and `quota_reconciliations` should be append-only attempt subrecords, not overwritten counters. That keeps the audit trail explicit and makes retry/refund behavior debuggable.

This gives judge-gym a maintainable v0: one shared key vocabulary, one algorithm family, and one conservative settlement policy, while still letting each provider/model select the dimensions it actually enforces.
