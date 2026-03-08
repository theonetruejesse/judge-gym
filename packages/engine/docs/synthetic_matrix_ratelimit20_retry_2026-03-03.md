# Synthetic Matrix Report (2026-03-03)

- generated_at: 2026-03-04T05:32:37.893Z
- label: ratelimit20_retry
- runner: `packages/engine/scripts/synthetic_matrix.ts`

## Scenarios

| id | kind | evidence | target_count | scheduler_kickoff | notes |
| --- | --- | ---: | ---: | --- | --- |
| window_job_baseline | window | 8 | - | true | Baseline job-route window (< min_batch_size). |
| run_mixed_baseline | run | 12 | 4 | true | Baseline run with low sample count and subset scoring fanout. |

## Results

- script_started_at: 2026-03-04T05:32:37.894Z

### window_job_baseline

- started_at: 2026-03-04T05:32:37.894Z
- kind: window
- evidence_count: 8
- target_count: -
- scheduler_kickoff: true
- notes: Baseline job-route window (< min_batch_size).

- nuke_before:
```json
{
  "passes": 2,
  "totalDeleted": 112
}
```
- window_created:
```json
{
  "window_id": "jx720qj1envk9acpsp66q3cg31828w28",
  "window_tag": "warm-cliff-TWcYPc"
}
```
