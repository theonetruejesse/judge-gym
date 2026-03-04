# Synthetic Matrix Report (2026-03-03)

- generated_at: 2026-03-04T04:35:20.019Z
- runner: `packages/engine/scripts/synthetic_matrix.ts`

## Scenarios

| id | kind | evidence | target_count | scheduler_kickoff | notes |
| --- | --- | ---: | ---: | --- | --- |
| window_job_baseline | window | 8 | - | true | Baseline job-route window (< min_batch_size). |
| window_batch_baseline | window | 30 | - | true | Baseline batch-route window (>= min_batch_size). |
| window_scheduler_recovery | window | 10 | - | false | Recovery drill: start orchestration without scheduler, then auto-heal. |
| run_mixed_baseline | run | 12 | 4 | true | Baseline run with low sample count and subset scoring fanout. |

## Results

- script_started_at: 2026-03-04T04:35:20.021Z

### window_job_baseline

- started_at: 2026-03-04T04:35:20.021Z
- kind: window
- evidence_count: 8
- target_count: -
- scheduler_kickoff: true
- notes: Baseline job-route window (< min_batch_size).

- nuke_before:
```json
{
  "passes": 2,
  "totalDeleted": 157
}
```
- window_created:
```json
{
  "window_id": "jx7fg3xgqm1qkgk6c35s4scqex8298ay",
  "window_tag": "solid-stream-sJ4cuL"
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
  "trace_id": "window:jx7fg3xgqm1qkgk6c35s4scqex8298ay",
  "window_id": "jx7fg3xgqm1qkgk6c35s4scqex8298ay"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx7fg3xgqm1qkgk6c35s4scqex8298ay",
  "sampled_events": 37,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 3260,
      "first_ts_ms": 1772598930339,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772598933599,
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
      "duration_ms": 20533,
      "first_ts_ms": 1772598933188,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772598953721,
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
      "duration_ms": 20892,
      "first_ts_ms": 1772598953315,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772598974207,
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
    "terminal_seq": 37
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 132
}
```

### window_batch_baseline

- started_at: 2026-03-04T04:36:26.625Z
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
  "window_id": "jx70em9e0dph7h52fptjknnk0s829cme",
  "window_tag": "warm-cliff-39PsKF"
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 30,
  "l1_completed": 30,
  "l2_completed": 30,
  "l3_completed": 30,
  "status": "completed",
  "trace_id": "window:jx70em9e0dph7h52fptjknnk0s829cme",
  "window_id": "jx70em9e0dph7h52fptjknnk0s829cme"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx70em9e0dph7h52fptjknnk0s829cme",
  "sampled_events": 136,
  "reached_end_of_trace": true,
  "route": "batch",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 3,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 130041,
      "first_ts_ms": 1772598994284,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772599124325,
      "request_applied": 30,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "batch",
      "stage": "l1_cleaned"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 5,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 221116,
      "first_ts_ms": 1772599123314,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772599344430,
      "request_applied": 30,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "batch",
      "stage": "l2_neutralized"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 2,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 100190,
      "first_ts_ms": 1772599343438,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772599443628,
      "request_applied": 30,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "batch",
      "stage": "l3_abstracted"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 0,
    "terminal_event_name": "window_completed",
    "terminal_seq": 136
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 471
}
```

### window_scheduler_recovery

- started_at: 2026-03-04T04:44:14.381Z
- kind: window
- evidence_count: 10
- target_count: -
- scheduler_kickoff: false
- notes: Recovery drill: start orchestration without scheduler, then auto-heal.

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
  "window_id": "jx71cph0e9r3wpxah6gfp1sgen829qqy",
  "window_tag": "brave-bay-8zKinN"
}
```
- recovery_check:
```json
{
  "stuck_reasons": [],
  "dry_action_count": 1,
  "dry_result_count": 1,
  "apply_action_count": 1,
  "apply_result_count": 1,
  "dry_actions": [
    {
      "action": "start_scheduler_if_idle"
    }
  ],
  "apply_actions": [
    {
      "action": "start_scheduler_if_idle"
    }
  ]
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 10,
  "l1_completed": 10,
  "l2_completed": 10,
  "l3_completed": 10,
  "status": "completed",
  "trace_id": "window:jx71cph0e9r3wpxah6gfp1sgen829qqy",
  "window_id": "jx71cph0e9r3wpxah6gfp1sgen829qqy"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx71cph0e9r3wpxah6gfp1sgen829qqy",
  "sampled_events": 43,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 30445,
      "first_ts_ms": 1772599461974,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599492419,
      "request_applied": 10,
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
      "duration_ms": 19924,
      "first_ts_ms": 1772599491945,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599511869,
      "request_applied": 10,
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
      "duration_ms": 20353,
      "first_ts_ms": 1772599511396,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599531749,
      "request_applied": 10,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l3_abstracted"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 0,
    "terminal_event_name": "window_completed",
    "terminal_seq": 43
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 158
}
```

### run_mixed_baseline

- started_at: 2026-03-04T04:45:42.798Z
- kind: run
- evidence_count: 12
- target_count: 4
- scheduler_kickoff: true
- notes: Baseline run with low sample count and subset scoring fanout.

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
  "window_id": "jx74v3xn782hsd4w5xk1kn6rc9828m8f",
  "window_tag": "gentle-ridge-RYz5Z6"
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
  "trace_id": "window:jx74v3xn782hsd4w5xk1kn6rc9828m8f",
  "window_id": "jx74v3xn782hsd4w5xk1kn6rc9828m8f"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx74v3xn782hsd4w5xk1kn6rc9828m8f",
  "sampled_events": 55,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 7879,
      "first_ts_ms": 1772599550302,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599558181,
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
      "duration_ms": 20403,
      "first_ts_ms": 1772599557670,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599578073,
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
      "duration_ms": 98474,
      "first_ts_ms": 1772599577490,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772599675964,
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
    "terminal_seq": 55
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- run_started:
```json
{
  "experiment_id": "j970zevcdjm86zj6anazpbneh9829w3v",
  "run_id": "kh7067kdnpx758xs8ca34fez7h8280j9"
}
```
- run_summary:
```json
{
  "current_stage": "score_critic",
  "run_id": "kh7067kdnpx758xs8ca34fez7h8280j9",
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
      "completed": 47,
      "failed": 0,
      "stage": "score_gen",
      "status": "running",
      "total": 48
    },
    {
      "completed": 47,
      "failed": 0,
      "stage": "score_critic",
      "status": "running",
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
  "trace_id": "run:kh7067kdnpx758xs8ca34fez7h8280j9",
  "sampled_events": 206,
  "reached_end_of_trace": true,
  "route": "mixed",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 20593,
      "first_ts_ms": 1772599700732,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599721325,
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
      "duration_ms": 10109,
      "first_ts_ms": 1772599690945,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772599701054,
      "request_applied": 4,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "rubric_gen"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 3,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 141605,
      "first_ts_ms": 1772599960148,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772600101753,
      "request_applied": 47,
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
      "duration_ms": 241526,
      "first_ts_ms": 1772599719992,
      "job_finalized": 6,
      "job_queued_handler_started": 6,
      "job_running_polled": 12,
      "last_ts_ms": 1772599961518,
      "request_applied": 47,
      "request_apply_duplicate_success": 0,
      "request_error": 1,
      "route": "job",
      "stage": "score_gen"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 2,
    "terminal_event_name": "run_completed",
    "terminal_seq": 204
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
    "score_critics": 47,
    "scores": 47
  },
  "current_stage": "score_critic",
  "failed_requests": [
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m977qf2qamqngrk1hvg3ked5ch829yms:score_gen",
      "last_error": "Unrecognized verdict label: VERDICT: C",
      "request_id": "k57e0fc2b2n90e99cr7g14efp5828x3b",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97axha4p443h0jkvs0rx6nc898285p0:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57a9khhzqwxvyfb7seahj6qj18289gd",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m973p9g30tyv59w4c19x54wrdx8291s1:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57fqajqpm5ff3d8fxq7temx55829b65",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97dvn264qfbxtna07368cghvx829zcw:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57b4xh1vgwsk7k8zwb3se74zx828h7a",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97988gw67edp6yv6d7spkmc91828mr4:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57a9q9f5sps5evy0hdsfcjetd828ehz",
      "status": "error"
    },
    {
      "attempts": 3,
      "custom_key": "sample_evidence:m97988gw67edp6yv6d7spkmc91828mr4:score_gen",
      "last_error": "Documents read from or written to the \"telemetry_trace_counters\" table changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID \"m57dyrd7hzh47wf01j3ewghqzx829hyc\". See https://docs.convex.dev/error#1",
      "request_id": "k57c26weh9q1x85crtvxyh677s829k3j",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m972c6sq5kxjw6vfkypqhgpk8d828nwy:score_gen",
      "last_error": "Unrecognized verdict label: ABC",
      "request_id": "k57438xmcmv7kryvap2xjmjzfs8299w7",
      "status": "error"
    }
  ],
  "request_counts": {
    "error": 7,
    "total": 109
  },
  "run_id": "kh7067kdnpx758xs8ca34fez7h8280j9",
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
      "success": 47
    },
    "score_gen": {
      "error": 7,
      "pending": 0,
      "success": 47
    }
  },
  "status": "completed",
  "target_count": 4,
  "trace_id": "run:kh7067kdnpx758xs8ca34fez7h8280j9"
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 937
}
```

## Complete

- finished_at: 2026-03-04T04:55:26.617Z
