# Activity Idempotency and an External Audit Ledger Are Core Rewrite Requirements

**Confidence:** 0.87

**Sources:**
- https://docs.temporal.io/encyclopedia/activities#activity-definition
- https://docs.temporal.io/retry-policies
- https://docs.temporal.io/encyclopedia/events-and-event-history
- https://docs.temporal.io/encyclopedia/event-history-limits
- https://docs.temporal.io/blog/activity-idempotency
- https://nodejs.temporal.io/docs/typescript/activities#retries

**Summary:**
Temporal does not provide exactly-once Activity execution. Activities can retry and can duplicate side effects, so idempotency has to be designed explicitly at the Activity boundary. Temporal also stores Activity inputs and return values in Workflow Event History, which makes history useful for debugging but a poor default home for large LLM prompts and outputs because event history size and count are bounded and large histories degrade execution performance.

For judge-gym, that makes an external audit/idempotency layer a hard requirement rather than an optional nice-to-have. The clean split is to keep `llm_prompt_templates` as a stable deduped data-facing table and replace the runtime-shaped parts of `llm_requests` with a deliberate append-only attempt ledger. The ledger should hold Temporal identity (`workflow_id`, `workflow_run_id`, `activity_id`), idempotency keys, domain linkage, provider/model metadata, timing, retry outcome, token/cost data, and either inline small outputs or blob references for large payloads. The most reliable base idempotency key is the Temporal-recommended `workflow_run_id/activity_id`, optionally paired with a business operation key when dedupe must survive `continue-as-new` or repeated logical operations.
