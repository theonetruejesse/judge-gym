# The Initial Registry Snapshot Should Map Provider Quota Dimensions Explicitly

**Confidence:** 0.79

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_022_provider_capability_divergence.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_024_minimal_v0_capability_registry_schema.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_026_v0_quota_dimensions_and_tracking_split.md
- https://platform.openai.com/docs/guides/rate-limits/usage-tiers
- https://platform.openai.com/docs/guides/text-generation/parameter-details
- https://docs.anthropic.com/en/api/rate-limits
- https://ai.google.dev/gemini-api/docs/quota
- https://openai.com/api-scale-tier/

**Summary:**
The initial provider-to-dimension mapping should be explicit in the registry rather than inferred from one “generic LLM” default.

For the first interactive v0 snapshot, the honest mapping is:

1. `openai` PAYG interactive models:
   - enforced dimensions: `requests`, `total_tokens`
   - tracked usage: `input_tokens`, `output_tokens`, `cached_input_tokens`, `thinking_tokens`
2. `anthropic` interactive models:
   - enforced dimensions: `requests`, `input_tokens`, `output_tokens`
   - tracked usage: provider-specific request/input/output estimates, cache-related accounting, and other extensions
3. `gemini` interactive models:
   - enforced dimensions: `requests`, `input_tokens`
   - tracked usage: output usage and reasoning details when available, but not an independently enforced output bucket in v0

Why this mapping is the right v0 default:

- OpenAI’s standard rate-limit guidance is built around request and token limits, and the API exposes `total_tokens` as the sum of input and output usage. That fits a `total_tokens` enforcement bucket better than pretending PAYG has split input/output token buckets in the shared limiter.
- Anthropic explicitly documents separate `ITPM` and `OTPM` limits, so the registry should model split input/output token enforcement directly instead of flattening them into one total bucket.
- Gemini documents request and input-token quota pressure, not an output-token-per-minute bucket, so the registry should not invent one in the v0 shared limiter.

The registry should also leave room for plan-specific or provider-mode overrides. The clearest example is OpenAI Scale Tier: once judge-gym supports a Scale Tier account or other non-PAYG token accounting, the mapping may need a provider-plan override that switches OpenAI from `total_tokens` to split `input_tokens`/`output_tokens` or another explicit quota profile.

So the v0 design rule is:

- keep one normalized quota vocabulary,
- but make each provider/model or provider/plan registry entry declare the subset it actually enforces,
- and do not force one provider’s billing shape onto the others.
