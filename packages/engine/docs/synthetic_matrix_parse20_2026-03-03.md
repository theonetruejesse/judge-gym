# Synthetic Matrix Report (2026-03-03)

- generated_at: 2026-03-04T04:56:24.446Z
- label: parse20
- runner: `packages/engine/scripts/synthetic_matrix.ts`

## Scenarios

| id | kind | evidence | target_count | scheduler_kickoff | notes |
| --- | --- | ---: | ---: | --- | --- |
| window_batch_baseline | window | 30 | - | true | Baseline batch-route window (>= min_batch_size). |
| run_mixed_baseline | run | 12 | 4 | true | Baseline run with low sample count and subset scoring fanout. |

## Results

- script_started_at: 2026-03-04T04:56:24.446Z

### window_batch_baseline

- started_at: 2026-03-04T04:56:24.447Z
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
  "window_id": "jx75q65ywh2sw00xq1yt2yc5tx82968j",
  "window_tag": "vivid-grove-swmxUm"
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 30,
  "l1_completed": 23,
  "l2_completed": 22,
  "l3_completed": 18,
  "status": "completed",
  "trace_id": "window:jx75q65ywh2sw00xq1yt2yc5tx82968j",
  "window_id": "jx75q65ywh2sw00xq1yt2yc5tx82968j"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx75q65ywh2sw00xq1yt2yc5tx82968j",
  "sampled_events": 107,
  "reached_end_of_trace": true,
  "route": "mixed",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 2,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 91683,
      "first_ts_ms": 1772600192305,
      "job_finalized": 0,
      "job_queued_handler_started": 0,
      "job_running_polled": 0,
      "last_ts_ms": 1772600283988,
      "request_applied": 23,
      "request_apply_duplicate_success": 0,
      "request_error": 7,
      "route": "batch",
      "stage": "l1_cleaned"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 97579,
      "first_ts_ms": 1772600283101,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772600380680,
      "request_applied": 22,
      "request_apply_duplicate_success": 0,
      "request_error": 1,
      "route": "job",
      "stage": "l2_neutralized"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 101018,
      "first_ts_ms": 1772600379915,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772600480933,
      "request_applied": 18,
      "request_apply_duplicate_success": 0,
      "request_error": 4,
      "route": "job",
      "stage": "l3_abstracted"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 0,
    "terminal_event_name": "window_completed",
    "terminal_seq": 107
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 405
}
```

### run_mixed_baseline

- started_at: 2026-03-04T05:01:33.910Z
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
  "window_id": "jx7f9rp13xyz2c8rr20p59wq3n829h7h",
  "window_tag": "eager-vessel-A1hI29"
}
```
- window_summary:
```json
{
  "current_stage": "l3_abstracted",
  "evidence_total": 12,
  "l1_completed": 11,
  "l2_completed": 11,
  "l3_completed": 11,
  "status": "completed",
  "trace_id": "window:jx7f9rp13xyz2c8rr20p59wq3n829h7h",
  "window_id": "jx7f9rp13xyz2c8rr20p59wq3n829h7h"
}
```
- window_analysis:
```json
{
  "trace_id": "window:jx7f9rp13xyz2c8rr20p59wq3n829h7h",
  "sampled_events": 65,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 86805,
      "first_ts_ms": 1772600501280,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772600588085,
      "request_applied": 11,
      "request_apply_duplicate_success": 0,
      "request_error": 1,
      "route": "job",
      "stage": "l1_cleaned"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 100202,
      "first_ts_ms": 1772600587591,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772600687793,
      "request_applied": 11,
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
      "duration_ms": 100789,
      "first_ts_ms": 1772600687302,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 2,
      "last_ts_ms": 1772600788091,
      "request_applied": 11,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "l3_abstracted"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 0,
    "terminal_event_name": "window_completed",
    "terminal_seq": 65
  },
  "duplicate_apply_success_total": 0,
  "jobs_finalized_multiple_times": 0
}
```
- run_started:
```json
{
  "experiment_id": "j9797mc31r3vfp8ydsatj0d5c1828w5g",
  "run_id": "kh75xmckakag401b3cdvay6rsh828zev"
}
```
- run_summary:
```json
{
  "current_stage": "score_critic",
  "run_id": "kh75xmckakag401b3cdvay6rsh828zev",
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
      "completed": 45,
      "failed": 0,
      "stage": "score_gen",
      "status": "running",
      "total": 48
    },
    {
      "completed": 43,
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
  "trace_id": "run:kh75xmckakag401b3cdvay6rsh828zev",
  "sampled_events": 431,
  "reached_end_of_trace": true,
  "route": "job",
  "stage_summaries": [
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 0,
      "batch_queued_handler_started": 0,
      "batch_submit_claim_denied": 0,
      "batch_success": 0,
      "duration_ms": 20641,
      "first_ts_ms": 1772600913714,
      "job_finalized": 1,
      "job_queued_handler_started": 1,
      "job_running_polled": 0,
      "last_ts_ms": 1772600934355,
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
      "duration_ms": 114640,
      "first_ts_ms": 1772600799399,
      "job_finalized": 4,
      "job_queued_handler_started": 4,
      "job_running_polled": 6,
      "last_ts_ms": 1772600914039,
      "request_applied": 4,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "rubric_gen"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 2,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 195284,
      "first_ts_ms": 1772601178035,
      "job_finalized": 10,
      "job_queued_handler_started": 8,
      "job_running_polled": 18,
      "last_ts_ms": 1772601373319,
      "request_applied": 43,
      "request_apply_duplicate_success": 0,
      "request_error": 1,
      "route": "job",
      "stage": "score_critic"
    },
    {
      "batch_poll_claim_denied": 0,
      "batch_polled": 3,
      "batch_queued_handler_started": 1,
      "batch_submit_claim_denied": 0,
      "batch_success": 1,
      "duration_ms": 246331,
      "first_ts_ms": 1772600933040,
      "job_finalized": 17,
      "job_queued_handler_started": 15,
      "job_running_polled": 34,
      "last_ts_ms": 1772601179371,
      "request_applied": 45,
      "request_apply_duplicate_success": 0,
      "request_error": 0,
      "route": "job",
      "stage": "score_gen"
    }
  ],
  "terminal_stats": {
    "events_after_terminal": 2,
    "terminal_event_name": "run_completed",
    "terminal_seq": 429
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
    "score_critics": 43,
    "scores": 45
  },
  "current_stage": "score_critic",
  "failed_requests": [
    {
      "attempts": 1,
      "custom_key": "sample:jh71wwvd4bg15tzz0g2j2zwtm9828dz4:rubric_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k578prmb0gxj5g9k43ajs0kdxn8289az",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample:jh786rgttznevd2t531yxgjd6n828bny:rubric_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k574hc9n0m544w8a0j14v2ggh1828jpj",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample:jh7bwrvf7gsx5jjfn09pv0fj75828545:rubric_gen",
      "last_error": "Invalid criteria count (2) for stage \"Strongest Support\"",
      "request_id": "k57ayafw41zn6bxb977vqjxej9829pc9",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m973pc27gzaaphzhbktq6s1ebd82818x:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k570b2scqzctbtr0wkxmstq7fx829eh5",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m976wyhktaftqh7ap5gnrgc8498298n1:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57am914tqz80qtfyg2kzfkgdn82888r",
      "status": "error"
    },
    {
      "attempts": 3,
      "custom_key": "sample_evidence:m976wyhktaftqh7ap5gnrgc8498298n1:score_critic",
      "last_error": "Documents read from or written to the \"telemetry_trace_counters\" table changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID \"m57f4kzr5mzdgwd5xj20h96jm18290yd\". See https://docs.convex.dev/error#1",
      "request_id": "k57f6se93ha46c6jhrwk631ar98288x7",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m9778stjtrz4mqevnysnrryfa9828t8a:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57fsdy05ntnh57s4cy3j00x7n828hr0",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m972gzm9h5qdvv31a600wk722n829nmj:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k5720eczc0rq9vb65y8n16axcd828556",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97agqfb0ye110rwcbj2e1rz45828ppg:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k5777jysdbpnc1404rhq7d40kd828bnb",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97a3xkf6js1x558h84vht6531829emv:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57anm9ac1ztpeqt2gmfvvsfjx829b7c",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m9799tysp6n03y5m75y92ypscd829g5y:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57eh67vw5mbg8j1dfy83j3hd1829gye",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m979eht0aye5s0p1kqttnac2zd828xpr:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57421zzsz1nvh0q6nc2zq887h828jcb",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97dpngy9nv4y3z7cv2sakqnkx828qc7:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57ermz4yx5kbmk0ay15gn6s6h829edd",
      "status": "error"
    },
    {
      "attempts": 3,
      "custom_key": "sample_evidence:m97dpngy9nv4y3z7cv2sakqnkx828qc7:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k573042vc7tg4408xmrccsccps829w5c",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m973c6pby2wk277k0p7avzrvvh8297g3:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k57c432xxtmsh4fqpcc4gq7xz98298rz",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97a2mq1jmex2szja1vaem6jp1828mvy:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57dn2h06jjdz4a8az0vr4tx1s829gd9",
      "status": "error"
    },
    {
      "attempts": 3,
      "custom_key": "sample_evidence:m97a2mq1jmex2szja1vaem6jp1828mvy:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57dj7dqnyc7bs487xwke9ydsx829rn8",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97enhj1mypf6szsxrwjxn1myn828ke7:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k570f8p9qdwy35mwwc8cvh6ftx828fns",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97enhj1mypf6szsxrwjxn1myn828ke7:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k578zcj1vt6219f38vg7tjmew5828jye",
      "status": "error"
    },
    {
      "attempts": 3,
      "custom_key": "sample_evidence:m97enhj1mypf6szsxrwjxn1myn828ke7:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k573pag03e24kw3bz5bye4etgd829a48",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m973tcb0yh3mrx42smwrrpawgd828yag:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k575c4p65gm2sp83nnkee78w4x828fwx",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m9773kp7cmzzeacgze4mc3hehd828kwg:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k5766rxkp0w97hcqevnag0qbed8284vj",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97eprxhdf64acsssc0e1yv5s18287q1:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57e1brvme39c49trpzysq8829828xnm",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97fpvpqzavk36kfsa4txz1rhd828krp:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57715ajcnr2p2aq5yfestvgns829n21",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97fpvpqzavk36kfsa4txz1rhd828krp:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57d0saa5bpzv0xbab6q5b2wy58299jz",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m975pnwe7qedtwqt8apjfgrbg9828v1z:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k572syng74h72fp8cgk9chfg8d8296rp",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m9740cn4xdnppdcjf1tx7m70b9829k3z:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57c2r2yeqgv5vpdzn17a93h0s829v1a",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m9745ndjkfn4frh0pym3nkjbg9828bz9:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k572ykjx9ey498wft1des0w9dd828fxe",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m972xn4ppy8kxgkgpk70ja7031828qs3:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57afh0b77mnw9jbrdv6w3sh99829wr7",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m972xn4ppy8kxgkgpk70ja7031828qs3:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k5762w3ygn0a72vgz6vfrx69rh829edp",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m97920tvaqsted0nx6d4fkrv6n828x3j:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k574peet98nb6s37b9azeyaggn8297xj",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m973s05xh2nw1dmh6yddk5xjxh829xpg:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57f0p8tqsmsmfg893hce2prm5828ee8",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m973s05xh2nw1dmh6yddk5xjxh829xpg:score_critic",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57d2xyz5y00wa7wrg4gdc7g718283nk",
      "status": "error"
    },
    {
      "attempts": 1,
      "custom_key": "sample_evidence:m970snt2cdavtm5r0fbcfqdwt18283tj:score_gen",
      "last_error": "synthetic_parse_error_injected",
      "request_id": "k57b4103js2s7d0rxgxn8pkp5h829har",
      "status": "error"
    },
    {
      "attempts": 3,
      "custom_key": "sample_evidence:m970snt2cdavtm5r0fbcfqdwt18283tj:score_gen",
      "last_error": "Unrecognized verdict label: BC",
      "request_id": "k576hnfg33n86cysp7md592nhx828320",
      "status": "error"
    }
  ],
  "request_counts": {
    "error": 35,
    "total": 131
  },
  "run_id": "kh75xmckakag401b3cdvay6rsh828zev",
  "stage_rollup": {
    "rubric_critic": {
      "error": 0,
      "pending": 0,
      "success": 4
    },
    "rubric_gen": {
      "error": 3,
      "pending": 0,
      "success": 4
    },
    "score_critic": {
      "error": 12,
      "pending": 0,
      "success": 43
    },
    "score_gen": {
      "error": 20,
      "pending": 0,
      "success": 45
    }
  },
  "status": "completed",
  "target_count": 4,
  "trace_id": "run:kh75xmckakag401b3cdvay6rsh828zev"
}
```
- nuke_after:
```json
{
  "passes": 2,
  "totalDeleted": 1275
}
```

## Complete

- finished_at: 2026-03-04T05:16:31.096Z
