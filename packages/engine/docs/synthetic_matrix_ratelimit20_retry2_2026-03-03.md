# Synthetic Matrix Report (2026-03-03)

- generated_at: 2026-03-04T05:40:38.144Z
- label: ratelimit20_retry2
- runner: `packages/engine/scripts/synthetic_matrix.ts`

## Scenarios

| id | kind | evidence | target_count | scheduler_kickoff | notes |
| --- | --- | ---: | ---: | --- | --- |
| window_job_baseline | window | 8 | - | true | Baseline job-route window (< min_batch_size). |
| run_mixed_baseline | run | 12 | 4 | true | Baseline run with low sample count and subset scoring fanout. |

## Results

- script_started_at: 2026-03-04T05:40:38.144Z

### window_job_baseline

- started_at: 2026-03-04T05:40:38.145Z
- kind: window
- evidence_count: 8
- target_count: -
- scheduler_kickoff: true
- notes: Baseline job-route window (< min_batch_size).

- nuke_before:
```json
{
  "passes": 2,
  "totalDeleted": 105
}
```
- window_created:
```json
{
  "window_id": "jx71954kxngkjdf2ejpbmdnfr1829cac",
  "window_tag": "gentle-ridge-DEuklo"
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 8,
  "l1_completed": 8,
  "l2_completed": 8,
  "l3_completed": 8,
  "status": "completed",
  "trace_id": "window:jx71954kxngkjdf2ejpbmdnfr1829cac",
  "window_id": "jx71954kxngkjdf2ejpbmdnfr1829cac"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx71954kxngkjdf2ejpbmdnfr1829cac",
  "sampled_events": 61,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 86609,
      "first_ts_ms": 1772602848775,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772602935384,
      "request_applied": 8,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l1_cleaned"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 100016,
      "first_ts_ms": 1772602934967,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772603034983,
      "request_applied": 8,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l2_neutralized"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 180066,
      "first_ts_ms": 1772603034537,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 4,
      "last_ts_ms": 1772603214603,
      "request_applied": 8,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l3_abstracted"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 0,
    "terminal_event_name": "window_completed",
    "terminal_seq": 61
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 172
}
```

### run_mixed_baseline

- started_at: 2026-03-04T05:47:11.710Z
- kind: run
- evidence_count: 12
- target_count: 4
- scheduler_kickoff: true
- notes: Baseline run with low sample count and subset scoring fanout.

- nuke_before:
```json
{
  "passes": 2,
  "totalDeleted": 1
}
```
- window_created:
```json
{
  "window_id": "jx7240dy9jphazffgn0s4bk9wh8291yw",
  "window_tag": "eager-vessel-t3bieM"
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 12,
  "l1_completed": 12,
  "l2_completed": 12,
  "l3_completed": 12,
  "status": "completed",
  "trace_id": "window:jx7240dy9jphazffgn0s4bk9wh8291yw",
  "window_id": "jx7240dy9jphazffgn0s4bk9wh8291yw"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx7240dy9jphazffgn0s4bk9wh8291yw",
  "sampled_events": 79,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 166827,
      "first_ts_ms": 1772603241062,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 4,
      "last_ts_ms": 1772603407889,
      "request_applied": 12,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l1_cleaned"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 101217,
      "first_ts_ms": 1772603407343,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772603508560,
      "request_applied": 12,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l2_neutralized"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 179932,
      "first_ts_ms": 1772603508055,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 4,
      "last_ts_ms": 1772603687987,
      "request_applied": 12,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
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
- run_started:
```json
{
  "experiment_id": "j97fwrd9snc64qef5jnawegrph8296b3",
  "run_id": "kh76nf03xcevje24v0h3943a8x828cxx"
}
```
- run_summary:
```json
{
  "current_stage": "score_critic",
  "run_id": "kh76nf03xcevje24v0h3943a8x828cxx",
  "stages": [
    {
      "completed": 4,
      "failed": 0,
      "stage": "rubric_gen",
      "status": "completed",
      "total": 4
    },
    {
      "completed": 4,
      "failed": 0,
      "stage": "rubric_critic",
      "status": "completed",
      "total": 4
    },
    {
      "completed": 48,
      "failed": 0,
      "stage": "score_gen",
      "status": "completed",
      "total": 48
    },
    {
      "completed": 48,
      "failed": 0,
      "stage": "score_critic",
      "status": "completed",
      "total": 48
    }
  ],
  "status": "completed",
  "target_count": 4
}
```
- run_analysis:
```json
{
  "trace_id": "run:kh76nf03xcevje24v0h3943a8x828cxx",
  "sampled_events": 239,
  "reached_end_of_trace": true,
  "route": "mixed",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 178391,
      "first_ts_ms": 1772603798802,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 4,
      "last_ts_ms": 1772603977193,
      "request_applied": 4,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "rubric_critic"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 91699,
      "first_ts_ms": 1772603707455,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772603799154,
      "request_applied": 4,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "rubric_gen"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 7,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 302426,
      "first_ts_ms": 1772604295736,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772604598162,
      "request_applied": 48,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "batch",
      "stage": "score_critic"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 3,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 321226,
      "first_ts_ms": 1772603975882,
      "job_finalized": 5,
      "job_queued_handler_started": 5,
      "job_running_polled": 14,
      "last_ts_ms": 1772604297108,
      "request_applied": 48,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "score_gen"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 2,
    "terminal_event_name": "run_completed",
    "terminal_seq": 237
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- run_diagnostics:
```json
{
  "artifact_counts": {
    "rubric_critics": 4,
    "rubrics": 4,
    "samples": 4,
    "score_critics": 48,
    "scores": 48
  },
  "current_stage": "score_critic",
  "failed_requests": [
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97ckhemq50h32059v9jnyscen828hes:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57bkk0rr8hfs0583z7z0b4vqx828s3w",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97emr5nj04m2pf27jfcsmv7xx828hzh:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57cdyfvgb11016dhbdtp26n49828jan",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97f7ancfet44gcfdsfxaxh961828qw3:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k571cp8z3a7gfe3cz4am2qqhvx828ek4",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97515rnc4eghpsekv5c9ehz55828fa9:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k578kavzqhtxsc754nd1r98sq9828gsn",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97cbhbfhdtc1v1kqmzg0jwf7d828k0a:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57bb9vcddvd9pq1cavmjzm6as828kwc",
      "status": "error"
    }
  ],
  "request_counts": {
    "error": 5,
    "total": 109
  },
  "run_id": "kh76nf03xcevje24v0h3943a8x828cxx",
  "stage_rollup": {
    "rubric_critic": {
      "error": 0,
      "pending": 0,
      "success": 4
    },
    "rubric_gen": {
      "error": 0,
      "pending": 0,
      "success": 4
    },
    "score_critic": {
      "error": 0,
      "pending": 0,
      "success": 48
    },
    "score_gen": {
      "error": 5,
      "pending": 0,
      "success": 48
    }
  },
  "status": "completed",
  "target_count": 4,
  "trace_id": "run:kh76nf03xcevje24v0h3943a8x828cxx"
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 1033
}
```

## Complete

- finished_at: 2026-03-04T06:10:17.471Z
