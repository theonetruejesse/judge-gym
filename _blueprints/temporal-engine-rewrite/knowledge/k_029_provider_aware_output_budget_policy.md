# V0 Output Reservation Should Follow Provider-Documented Quota Semantics

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_027_upstash_v0_settlement_policy.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_028_initial_provider_dimension_mapping.md
- https://platform.openai.com/docs/guides/reasoning/use-case-examples
- https://platform.openai.com/docs/guides/text-generation/parameter-details
- https://docs.anthropic.com/en/api/rate-limits
- https://ai.google.dev/gemini-api/docs/quota

**Summary:**
The open v0 question should be resolved in favor of **provider-aware reservation rules**, not a generic “bounded heuristic” that silently under-reserves for some providers.

The correct first-cut policy is:

1. `openai` PAYG interactive models with `total_tokens`
   - preflight reserve: `estimated_input_tokens + reserved_output_budget`
   - `reserved_output_budget` should default to the full requested output cap (`max_output_tokens`, provider-equivalent field, or the engine-applied default cap if the caller omitted one)
   - reason: OpenAI’s standard token accounting is total-token oriented, and reasoning tokens count toward output usage, so under-reserving output would make the shared total-token bucket dishonest

2. `anthropic` interactive models with split `output_tokens`
   - preflight reserve: full requested `max_tokens`
   - reconcile to actual output usage after completion
   - reason: Anthropic explicitly documents that `OTPM` is estimated from `max_tokens` at request start and adjusted later, so reserving less than `max_tokens` in the shared limiter would be less conservative than the provider itself

3. `gemini` interactive models without an output bucket
   - no output-side shared-bucket reservation in v0
   - reserve only the provider’s enforced dimensions, currently `requests` and `input_tokens`
   - reason: the shared limiter should not invent an output bucket the provider docs do not require

This means v0 should reject the earlier idea of a provider-specific “bounded” output heuristic for Anthropic. The provider already defines the safe start-of-request estimate: `max_tokens`.

What heuristics are still allowed in v0:

- estimating input tokens before the provider reports actual usage
- deriving an output cap from the engine’s default policy when the caller omitted one
- future provider-plan overrides where documentation supports a different quota shape

What v0 should not do:

- reserve less than the declared output cap for Anthropic
- reserve less than the effective output cap inside OpenAI’s `total_tokens` bucket based only on historical averages or wishful expected output
- create Gemini output reservations without documented quota pressure that justifies them

So the v0 rule is simple:

- reserve according to the provider’s documented quota semantics,
- reconcile after completion,
- and keep “smart” output heuristics out of the shared limiter until provider docs and real ops data justify them.
