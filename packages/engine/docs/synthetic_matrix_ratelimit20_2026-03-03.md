# Synthetic Matrix Report (2026-03-03)

- generated_at: 2026-03-04T05:23:38.153Z
- label: ratelimit20
- runner: `packages/engine/scripts/synthetic_matrix.ts`

## Scenarios

| id | kind | evidence | target_count | scheduler_kickoff | notes |
| --- | --- | ---: | ---: | --- | --- |
| window_job_baseline | window | 8 | - | true | Baseline job-route window (< min_batch_size). |
| run_mixed_baseline | run | 12 | 4 | true | Baseline run with low sample count and subset scoring fanout. |

## Results

- script_started_at: 2026-03-04T05:23:38.154Z

### window_job_baseline

- started_at: 2026-03-04T05:23:38.154Z
- kind: window
- evidence_count: 8
- target_count: -
- scheduler_kickoff: true
- notes: Baseline job-route window (< min_batch_size).

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
  "window_id": "jx7bgh8pr0anr1yt20bgx21xm58286f3",
  "window_tag": "proud-gate-GfdLIi"
}
```
## Failure

```text
Error: Timeout waiting for window jx7bgh8pr0anr1yt20bgx21xm58286f3
    at waitForWindow (/Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/synthetic_matrix.ts:236:13)
    at async executeScenario (/Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/synthetic_matrix.ts:390:31)
    at async main (/Users/jesselee/dev/research/jg/judge-gym/packages/engine/scripts/synthetic_matrix.ts:437:11)
```
