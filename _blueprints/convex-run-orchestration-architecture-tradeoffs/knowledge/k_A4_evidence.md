# A4 Queue/Table-Driven Worker Pipeline Evidence

**Confidence:** 0.79

**Sources:**
- Local: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_repo.ts`
- Local: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts`
- Local: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/process_workflows.ts`
- Local: `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/settings.ts`
- Convex OCC docs: https://docs.convex.dev/database/advanced/occ
- Convex scheduled functions docs: https://docs.convex.dev/scheduling/scheduled-functions
- Convex action retries (primary Convex engineering docs): https://stack.convex.dev/action-retries
- AWS SQS visibility timeout: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- AWS SQS dead-letter queues: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- Google Cloud Tasks common pitfalls: https://cloud.google.com/tasks/docs/common-pitfalls
- Stripe idempotent requests: https://docs.stripe.com/api/idempotent_requests
- PostgreSQL `FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html

## Evidence Claims

1. Current scheduler behavior is scan-and-dispatch, not queue-claim.
`runScheduler` reads all queued/running batches and jobs, then starts async workflows per row (`scheduler.ts`, lines 70-135). There is no dedicated queue table with ordered dequeue semantics (for example, `next_run_at` index + LIMIT claim batch).

2. The current design already uses per-batch lease fields as an ad hoc claim mechanism.
`llm_batch_repo` stores `poll_claim_owner` + `poll_claim_expires_at` and grants claims when missing/expired (`llm_batch_repo.ts`, lines 90-157). This is equivalent to message visibility lease semantics in queue systems.

3. Scheduler and worker both gate on lease, reducing but not eliminating duplicate starts.
Scheduler checks active lease before launching running-batch workflows (`scheduler.ts`, lines 106-115), and workflow handler re-checks + claims again (`process_workflows.ts`, lines 298-323). This is a useful double-check pattern under concurrent ticks.

4. Lease duration is fixed at 30s while scheduler ticks every 5s, which can allow re-claim if processing exceeds lease.
`BATCH_POLL_LEASE_MS = 30_000` (`process_workflows.ts`, line 34) and `poll_interval_ms = 5_000` (`settings.ts`). If an action/poll/finalization path runs longer than lease, another worker can legally acquire claim after expiry. This is standard at-least-once lease behavior unless lease extension/heartbeat is implemented.

5. Convex scheduling semantics imply idempotency is mandatory for action-backed worker stages.
Convex docs state scheduled mutations are guaranteed exactly once, while actions are at-most-once; if mutation and action are mixed, idempotency is required across retries/scheduling boundaries. Current batch processing calls actions (`pollOpenAiBatchAction`) and then mutates state, so queue workers must be idempotent in result-apply path.

6. Convex OCC gives safe single-document claim writes, but high-contention claim docs can become retry hotspots.
OCC docs state concurrent conflicting writes cause one transaction to retry; this helps enforce exclusive claim transitions but can increase retries under contention. Queue-table design should avoid hot single documents and favor per-unit claim rows.

7. Industry queue systems model claim/lease exactly this way and assume duplicate delivery/execution.
AWS SQS visibility timeout hides a claimed message for a lease window and returns it after timeout if not deleted. Google Cloud Tasks explicitly documents duplicate execution and non-ordered execution, recommending idempotent handlers. This aligns with designing run-unit workers for at-least-once processing.

8. Queue patterns require explicit poison-message handling.
AWS DLQ guidance uses `maxReceiveCount` to quarantine repeatedly failing messages. Current batch pipeline has retry counts (`attempts` fields) but no explicit queue-row dead-letter state for run units. A queue table can make failure isolation and replay explicit.

9. External idempotency-key patterns are directly applicable to run-unit side effects.
Stripe idempotency stores first result per key and replays it for retried requests, including failures. Equivalent local pattern: persist deterministic idempotency keys per run unit (for provider submit, finalize, and result-apply) so lease expiry/retries do not duplicate side effects.

10. PostgreSQL `SKIP LOCKED` queue claims are analogous to claim-and-lease dequeue; Convex requires modeling this in documents + OCC rather than SQL row locks.
Postgres docs describe `SKIP LOCKED` as queue-like non-blocking lock avoidance. In Convex, the analogous pattern is: query candidate units then claim each with OCC-guarded mutation (owner + lease expiry), accepting occasional contention retries.

## Local Assessment vs Explicit Queue Table

- Current strengths:
Existing batch code already has core lease primitives and explicit release paths (`finally` blocks), which reduces overlap and supports recovery.

- Current structural gaps for run-unit scale:
No dedicated queue table/index for due work units, scheduler does broad status scans, no first-class DLQ state, no lease heartbeat/extension, and idempotency seems distributed across handlers rather than centralized per unit key.

- A4 implication:
An explicit `run_units` queue table with states (`queued`, `claimed`, `done`, `dead`), due/priority index, owner+lease, receive count, and deterministic idempotency key would likely improve throughput predictability and correctness under concurrency by making at-least-once semantics explicit and observable.

## Uncertainties

- No production contention/latency telemetry was reviewed here, so duplicate frequency and OCC retry cost are inferred from code structure, not measured runtime.
- It is unclear whether provider actions can exceed 30s often enough to make lease expiry overlap common.
- Existing request/result application paths may already be sufficiently idempotent; this needs targeted replay/failure injection tests to confirm.
