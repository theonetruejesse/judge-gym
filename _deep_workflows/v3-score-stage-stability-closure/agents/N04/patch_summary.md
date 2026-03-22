# N04 Patch Summary

## Objective

Remove the remaining `score_gen` pre-batch timeout family without relying on a larger single preflight timeout.

## Implemented Shape

- Persist batch-preparation progress on `llm_batch_executions` before provider batch submission.
- Create or restore the batch execution row before staging new attempt-start writes.
- Record `recordLlmAttemptStart` in page-bounded segments instead of one large fanout.
- Rehydrate previously recorded batch attempts from `attempt_records_json` so replay resumes instead of re-recording earlier targets.
- Catch batch-preamble failures inside the run-stage activity and convert them into `markRunProcessError` with the concrete failure cause.

## Changed Runtime Behavior

- `score_gen` no longer treats the full attempt-start fanout as one 60-second preflight segment.
- If batch preparation partially succeeds, replay resumes from persisted attempt checkpoints.
- If batch preparation still fails, the run now stores the concrete process error message instead of collapsing only into a generic activity failure.

## Files Touched

- `apps/engine-temporal/src/run/service.ts`
- `apps/engine-temporal/src/mocha/run-service.test.ts`
- `apps/engine-temporal/src/convex/client.ts`
- `apps/engine-convex/convex/models/batches.ts`
- `apps/engine-convex/convex/packages/worker.ts`
- `apps/engine-convex/convex/tests/worker_idempotency.test.ts`
- `README.md`
