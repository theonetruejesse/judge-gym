# Synthetic Matrix Report (2026-03-03)

- generated_at: 2026-03-04T05:17:05.784Z
- label: parse50
- runner: `packages/engine/scripts/synthetic_matrix.ts`

## Scenarios

| id | kind | evidence | target_count | scheduler_kickoff | notes |
| --- | --- | ---: | ---: | --- | --- |
| window_batch_baseline | window | 30 | - | true | Baseline batch-route window (>= min_batch_size). |

## Results

- script_started_at: 2026-03-04T05:17:05.784Z

### window_batch_baseline

- started_at: 2026-03-04T05:17:05.784Z
- kind: window
- evidence_count: 30
- target_count: -
- scheduler_kickoff: true
- notes: Baseline batch-route window (>= min_batch_size).

- nuke_before:
```json
{
  "passes": 1,
  "totalDeleted": 0
}
```
- window_created:
```json
{
  "window_id": "jx729hmkedqkhrqs15b58jeac5829wpe",
  "window_tag": "bold-garden-V6LmLt"
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 30,
  "l1_completed": 11,
  "l2_completed": 6,
  "l3_completed": 5,
  "status": "completed",
  "trace_id": "window:jx729hmkedqkhrqs15b58jeac5829wpe",
  "window_id": "jx729hmkedqkhrqs15b58jeac5829wpe"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx729hmkedqkhrqs15b58jeac5829wpe",
  "sampled_events": 79,
  "reached_end_of_trace": true,
  "route": "mixed",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 2,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 91974,
      "first_ts_ms": 1772601433485,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772601525459,
      "request_applied": 11,
      "request_apply_duplicate_success": 0,
      "request_error": 19,
      "route": "batch",
      "stage": "l1_cleaned"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 97184,
      "first_ts_ms": 1772601524844,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772601622028,
      "request_applied": 6,
      "request_apply_duplicate_success": 0,
      "request_error": 5,
      "route": "job",
      "stage": "l2_neutralized"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 98662,
      "first_ts_ms": 1772601621638,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772601720300,
      "request_applied": 5,
      "request_apply_duplicate_success": 0,
      "request_error": 1,
      "route": "job",
      "stage": "l3_abstracted"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 0,
    "terminal_event_name": "window_completed",
    "terminal_seq": 79
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 287
}
```

## Complete

- finished_at: 2026-03-04T05:22:10.329Z
