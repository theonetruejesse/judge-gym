# Final Report: V3 Score Stage Stability Closure

## Objective

Patch the remaining score_gen batch-attempt timeout and observability gaps, validate, deploy, reset the V3 cohort to preflight_clean, then hand control back to the v3-finish-pass relaunch gate.

## Workflow Summary

- Objective class: finish_pass
- Operating mode: live_ops_with_patch
- Execution mode: compile_and_execute

## Findings

- The failing score-stage segment was the 60-second preflight guard around `recordLlmAttemptStart`, not the 2-hour batch wait or the 150-minute activity budget.
- The prior patch still replayed large attempt-start fanout inside one pre-batch segment, so full-cohort `score_gen` could still fail before any provider batch existed.
- `llm_batch_executions` was the right durable continuation boundary because it already owns batch identity and lifecycle, and it could absorb attempt-record checkpoints without a new table.
- The implemented patch now persists `attempt_recorded_count` and `attempt_records_json`, restores those checkpoints on replay, pages fresh attempt-start writes, and converts preamble failure into explicit run process errors.
- Local validation passed, the worker deploy succeeded, and the failed cohort was reset back to manifest-scoped `preflight_clean`.

## Decisions

- Rejected a pure `llm.preflightTimeoutMs` increase.
- Rejected a logging-only fix.
- Accepted durable checkpointing on `llm_batch_executions` plus page-bounded attempt recording before provider batch submission.
- Handed control back at a clean relaunch gate instead of launching inside the workflow.

## Validation

- `bun run validate:convex`
- `cd apps/engine-temporal && bun run test -- src/mocha/run-service.test.ts`
- `bun run typecheck`
- Railway deploy `1ac971f7-7102-4b28-989b-3f807fa9078c` reached `SUCCESS`
- Live manifest-scoped campaign status returned to `preflight_clean` with `launch_ready = true`
