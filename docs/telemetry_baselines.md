# Telemetry Baselines

This doc tracks stable before/after telemetry snapshots while we optimize run/window orchestration.

## Baseline A

- captured_at: 2026-03-03
- process_type: `window`
- process_id: `jx7athf2nmyhgm0f5da64zjn15826jqf`
- trace_id: `window:jx7athf2nmyhgm0f5da64zjn15826jqf`
- command: `bun run debug:analyze --window jx7athf2nmyhgm0f5da64zjn15826jqf --max-events 5000`

### Summary

- sampled_events: `181`
- reached_end_of_trace: `true`
- seq_range: `1..181`
- missing_seq_count: `0`
- duplicate_seq_count: `0`
- counter_next_seq: `182`
- counter_matches_seq_max: `true`
- duration_ms: `562110` (~562.11s)
- terminal_event: `window_completed`
- events_after_terminal: `13`

### Request/Job Churn

- unique_request_entities: `27`
- request_applied_total: `27`
- duplicate_apply_success_total: `104`
- requests_with_duplicate_apply_success: `25`
- max_duplicate_apply_success_per_request: `9`

- unique_job_entities: `3`
- job_finalized_total: `21`
- jobs_finalized_multiple_times: `3`
- max_job_finalized_per_job: `10`

### Top Events

- `request_apply_duplicate_success`: `104`
- `request_applied`: `27`
- `job_finalized`: `21`
- `job_running_polled`: `18`
- `job_queued_handler_started`: `3`
- `window_stage_advanced`: `2`
- `window_completed`: `1`

### Stage Notes

- `l1_cleaned`: route=`job`, applied=`9`, duplicate_apply=`61`, job_finalized=`10`
- `l2_neutralized`: route=`job`, applied=`9`, duplicate_apply=`24`, job_finalized=`6`
- `l3_abstracted`: route=`job`, applied=`9`, duplicate_apply=`19`, job_finalized=`5`

## Next Baseline Template

- captured_at:
- process_type:
- process_id:
- trace_id:
- command:

### Summary

- sampled_events:
- reached_end_of_trace:
- seq_range:
- missing_seq_count:
- duplicate_seq_count:
- counter_next_seq:
- counter_matches_seq_max:
- duration_ms:
- terminal_event:
- events_after_terminal:

### Request/Job Churn

- unique_request_entities:
- request_applied_total:
- duplicate_apply_success_total:
- requests_with_duplicate_apply_success:
- max_duplicate_apply_success_per_request:
- unique_job_entities:
- job_finalized_total:
- jobs_finalized_multiple_times:
- max_job_finalized_per_job:

### Top Events

- event_1:
- event_2:
- event_3:

### Stage Notes

- stage_1:
- stage_2:
- stage_3:

## Baseline B

- captured_at: 2026-03-03
- process_type: `window`
- process_id: `jx78bk5443p1axc3j6d5xcjne1826smz`
- trace_id: `window:jx78bk5443p1axc3j6d5xcjne1826smz`
- command: `bun run debug:analyze --window jx78bk5443p1axc3j6d5xcjne1826smz --max-events 5000`

### Summary

- sampled_events: `178`
- reached_end_of_trace: `true`
- seq_range: `1..178`
- missing_seq_count: `0`
- duplicate_seq_count: `0`
- counter_next_seq: `179`
- counter_matches_seq_max: `true`
- duration_ms: `480446` (~480.45s)
- terminal_event: `window_completed`
- events_after_terminal: `12`

### Request/Job Churn

- unique_request_entities: `27`
- request_applied_total: `27`
- duplicate_apply_success_total: `101`
- requests_with_duplicate_apply_success: `24`
- max_duplicate_apply_success_per_request: `9`

- unique_job_entities: `3`
- job_finalized_total: `21`
- jobs_finalized_multiple_times: `3`
- max_job_finalized_per_job: `10`

### Top Events

- `request_apply_duplicate_success`: `101`
- `request_applied`: `27`
- `job_finalized`: `21`
- `job_running_polled`: `18`
- `job_queued_handler_started`: `3`
- `window_stage_advanced`: `2`
- `window_completed`: `1`

### Stage Notes

- `l1_cleaned`: route=`job`, applied=`9`, duplicate_apply=`56`, job_finalized=`10`
- `l2_neutralized`: route=`job`, applied=`9`, duplicate_apply=`24`, job_finalized=`6`
- `l3_abstracted`: route=`job`, applied=`9`, duplicate_apply=`21`, job_finalized=`5`

## A vs B Quick Diff

- sampled_events: `181 -> 178` (slightly better)
- duration_ms: `562110 -> 480446` (faster)
- duplicate_apply_success_total: `104 -> 101` (still very high)
- events_after_terminal: `13 -> 12` (still present)
- jobs_finalized_multiple_times: `3 -> 3` (no improvement)

Conclusion: behavior is still dominated by duplicate post-success/post-finalize churn; optimization work should target idempotent apply/finalize + scheduling re-entry guards.

## Baseline C

- captured_at: 2026-03-03
- process_type: `window`
- process_id: `jx7aqndrsdwvns0dc98mtq3d01828jdp`
- trace_id: `window:jx7aqndrsdwvns0dc98mtq3d01828jdp`
- command: MCP analysis (`packages/lab:getTraceEvents` + table checks)

### Summary

- sampled_events: `72`
- reached_end_of_trace: `true`
- seq_range: `1..72`
- missing_seq_count: `0`
- duplicate_seq_count: `0`
- counter_next_seq: `73`
- counter_matches_seq_max: `true`
- duration_ms: `612877` (~612.88s)
- terminal_event: `window_completed`
- events_after_terminal: `2`

### Request/Job Churn

- unique_request_entities: `27`
- request_applied_total: `27`
- duplicate_apply_success_total: `0`
- requests_with_duplicate_apply_success: `0`
- max_duplicate_apply_success_per_request: `0`

- unique_job_entities: `3`
- job_finalized_total: `3`
- jobs_finalized_multiple_times: `0`
- max_job_finalized_per_job: `1`

### Top Events

- `request_applied`: `27`
- `job_run_claimed`: `17`
- `job_running_polled`: `14`
- `job_finalized`: `3`
- `job_queued_handler_started`: `3`
- `window_stage_advanced`: `2`
- `window_completed`: `1`

### Stage Notes

- `l1_cleaned`: route=`job`, applied=`9`, duplicate_apply=`0`, job_finalized=`1`
- `l2_neutralized`: route=`job`, applied=`9`, duplicate_apply=`0`, job_finalized=`1`
- `l3_abstracted`: route=`job`, applied=`9`, duplicate_apply=`0`, job_finalized=`1`

## B vs C Quick Diff

- sampled_events: `178 -> 72` (major reduction)
- duplicate_apply_success_total: `101 -> 0` (fixed)
- job_finalized_total: `21 -> 3` (fixed)
- events_after_terminal: `12 -> 2` (significantly reduced)
- duration_ms: `480446 -> 612877` (slower wall-clock despite cleaner writes)

Conclusion: correctness and write-efficiency improved materially; next optimization loop should focus on throughput (job polling cadence, per-job request execution parallelism, and stage handoff latency).

## Baseline D (Stress: Job Path)

- captured_at: 2026-03-03
- process_type: `window`
- process_id: `jx725s36mv8z8bxb5pg3wcdya9828nje`
- trace_id: `window:jx725s36mv8z8bxb5pg3wcdya9828nje`
- query: `the economy`
- evidence_limit: `10`
- command: `packages/codex:analyzeProcessTelemetry`

### Summary

- sampled_events: `50`
- reached_end_of_trace: `true`
- seq_range: `1..50`
- missing_seq_count: `0`
- duplicate_seq_count: `0`
- counter_next_seq: `51`
- counter_matches_seq_max: `true`
- duration_ms: `171308` (~171.31s)
- terminal_event: `window_completed`
- events_after_terminal: `2`

### Request/Job Churn

- unique_request_entities: `27`
- request_applied_total: `27`
- duplicate_apply_success_total: `0`
- requests_with_duplicate_apply_success: `0`
- max_duplicate_apply_success_per_request: `0`

- unique_job_entities: `3`
- job_finalized_total: `3`
- jobs_finalized_multiple_times: `0`
- max_job_finalized_per_job: `1`

### Top Events

- `request_applied`: `27`
- `job_run_claimed`: `6`
- `job_finalized`: `3`
- `job_queued_handler_started`: `3`
- `job_running_polled`: `3`

### Stage Notes

- `l1_cleaned`: route=`job`, applied=`9`, duplicate_apply=`0`, job_finalized=`1`, duration_ms=`122302`
- `l2_neutralized`: route=`job`, applied=`9`, duplicate_apply=`0`, job_finalized=`1`, duration_ms=`36041`
- `l3_abstracted`: route=`job`, applied=`9`, duplicate_apply=`0`, job_finalized=`1`, duration_ms=`45112`

## Baseline E (Stress: Batch Path)

- captured_at: 2026-03-03
- process_type: `window`
- process_id: `jx7ahz7zzc7dd5f0frgf01v15d828wd9`
- trace_id: `window:jx7ahz7zzc7dd5f0frgf01v15d828wd9`
- query: `foreign policy`
- evidence_limit: `40`
- command: `packages/codex:analyzeProcessTelemetry`

### Summary

- sampled_events: `170`
- reached_end_of_trace: `true`
- seq_range: `1..170`
- missing_seq_count: `0`
- duplicate_seq_count: `0`
- counter_next_seq: `171`
- counter_matches_seq_max: `true`
- duration_ms: `591636` (~591.64s)
- terminal_event: `window_completed`
- events_after_terminal: `2`

### Request/Job Churn

- unique_request_entities: `111`
- request_applied_total: `111`
- duplicate_apply_success_total: `0`
- requests_with_duplicate_apply_success: `0`
- max_duplicate_apply_success_per_request: `0`

- unique_job_entities: `0`
- job_finalized_total: `0`
- jobs_finalized_multiple_times: `0`
- max_job_finalized_per_job: `0`

### Top Events

- `request_applied`: `111`
- `batch_poll_claimed`: `13`
- `batch_polled`: `13`
- `batch_still_running`: `10`
- `batch_success`: `3`

### Stage Notes

- `l1_cleaned`: route=`batch`, applied=`37`, duplicate_apply=`0`, batch_success=`1`, duration_ms=`297784`
- `l2_neutralized`: route=`batch`, applied=`37`, duplicate_apply=`0`, batch_success=`1`, duration_ms=`141217`
- `l3_abstracted`: route=`batch`, applied=`37`, duplicate_apply=`0`, batch_success=`1`, duration_ms=`140408`

## D vs E Quick Diff (Concurrent Run)

- routing: `job-only` vs `batch-only` (as expected by `min_batch_size`)
- evidence per stage: `9` vs `37`
- duration_ms: `171308 -> 591636`
- duplicate_apply_success_total: `0 -> 0` (stable)
- events_after_terminal: `2 -> 2` (stable)

Conclusion: correctness is stable in both routes; for high-cardinality windows, overall latency is now dominated by batch poll cadence/provider completion latency rather than duplicate processing churn.
