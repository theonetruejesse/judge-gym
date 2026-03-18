# The LLM Attempt Ledger Should Be Metadata-First, Append-Only, and Split Across Envelope, Payload, and Quota Event Shapes

**Confidence:** 0.79

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_007_activity_idempotency_and_audit_ledger.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_013_ledger_schema_and_provider_semantics.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_023_provider_portable_code_architecture.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_025_llm_attempt_envelope_and_upstash_key_model.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_027_upstash_v0_settlement_policy.md
- https://docs.convex.dev/production/state/limits
- https://platform.openai.com/docs/api-reference/batch/retrieve
- https://docs.anthropic.com/en/api/messages

**Summary:**
The ledger gap is now narrow enough to close. The rewrite should stop talking about a generic future `llm_attempts` table and instead commit to a metadata-first, append-only design with a compact attempt envelope plus explicit payload-ref and quota-audit structures.

The cleanest fully explicit shape is:

1. `llm_attempts`
   - one row per provider-call attempt
   - attempt identity, business operation key, Temporal linkage, domain linkage, provider/model ids, provider correlation ids, lifecycle, normalized usage, reservation estimates, retention class, and compact payload references

2. `llm_attempt_payloads`
   - zero or more blob-reference rows per attempt
   - backend, blob ref, hash, size, content type, expiry, and redaction metadata

3. `llm_attempt_quota_events`
   - append-only reservation / reconcile / refund events
   - explicit dimension ids, amounts, quota keys, result, and idempotency keys

This split is justified both by correctness and by storage reality. Temporal Activities are not exactly-once, so attempt identity and dedupe must be explicit. Convex’s document size limits also make “store full request/response in one document” a dead end for real LLM payloads.

The important architectural commitment is the split of concerns, not necessarily shipping all three shapes as separate Convex tables on day one. If v0 needs to stay slightly narrower, quota events can remain embedded or lightly normalized as long as:

- attempt metadata stays append-only,
- payload bodies stay out of the main attempt envelope,
- and reservation/reconciliation remains auditable.

The v0 contract should keep these fields first-class in `llm_attempts`:

- attempt identity and business-operation identity
- `workflow_id`, `workflow_run_id`, `activity_id`, `activity_attempt`
- `process_kind`, `process_id`, `stage_key`, `operation_type`
- `provider_id`, `model_id`, optional `provider_plan`, `registry_snapshot_id`
- provider correlation ids that matter operationally across providers
- `status`, timestamps, short error metadata
- normalized usage fields
- `estimated_input_tokens`, `reserved_output_budget`, optional `reserved_total_budget`, reconciliation flags
- `retention_class`, payload refs, hashes, expiry metadata

The replay contract should also be explicit:

- always retain the immutable attempt envelope, normalized usage, correlation ids, hashes, and the references needed to re-render if reproducibility matters
- optionally retain raw payload blobs for bounded debug windows
- if raw payloads expire or are redacted, the guarantee degrades from byte-for-byte replay to audit traceability unless the render inputs are still preserved

The blueprint should also state this directly: full reproducibility is only possible when the system retains the render inputs and other sensitive material needed to reconstruct the prompt. Otherwise the retained hashes and metadata only guarantee auditability, not full replay.

Provider-specific details should stay in `provider_extensions` unless they are operationally critical across multiple providers. That keeps the schema stable while preserving enough provider truth for future Gemini/Claude support.
