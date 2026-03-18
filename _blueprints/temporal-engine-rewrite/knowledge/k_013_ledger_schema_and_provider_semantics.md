# The LLM Attempt Ledger Must Capture Provider Semantics, Not Just Temporal Retries

**Confidence:** 0.66

**Sources:**
- https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- https://platform.openai.com/docs/api-reference/batch/retrieve
- https://platform.openai.com/docs/guides/batch
- https://platform.openai.com/docs/guides/prompt-caching
- https://help.openai.com/en/articles/9197833-batch-api-faq
- https://docs.convex.dev/production/state/limits
- https://docs.temporal.io/encyclopedia/activities#activity-definition
- https://docs.temporal.io/blog/activity-idempotency

**Summary:**
The existing `llm_requests` table mixes runtime scheduling concerns with data-facing prompt/output audit. In a Temporal rewrite, the runtime part should disappear, but the audit part should become more explicit, not less. The engine currently routes through OpenAI chat and OpenAI batch, which means the replacement ledger must carry real provider semantics: request correlation IDs, batch IDs and file IDs, `custom_id` join keys, per-line batch results, partial completion states, token usage, prompt caching details, and cost mode differences such as batch discounting.

The safest replacement is a metadata-first append-only `llm_attempts` ledger, with `llm_prompt_templates` kept as the deduped canonical template store. Large request and response bodies should not be stuffed into Convex or Temporal history by default; instead, store enough immutable replay metadata inline to preserve reproducibility and use blob references plus hashes for large payloads. The ledger still needs explicit fields for template versioning, rendered-prompt hashes, provider/model identifiers, batch terminal reasons, retention class, blob metadata, and stable dedupe keys. The right artifact invariant is also separate from the attempt ledger: retries should be deduped via Temporal/idempotency keys, while scientific artifacts should be protected by business-operation keys per stage/target.
