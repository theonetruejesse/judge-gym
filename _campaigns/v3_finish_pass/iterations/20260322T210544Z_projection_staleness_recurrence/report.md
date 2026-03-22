# V3 Iteration Report: 20260322T210544Z_projection_staleness_recurrence

- Manifest version: `2`
- Launch mode: `full`
- Expected cohort: `18` manifest-tagged experiments
- Observed cohort at failure snapshot: `18/18` latest runs bound, `18` running, `14` in `rubric_critic`, `4` in `score_gen`
- Campaign status at captured snapshot: `stalled_recoverable`
- Scientific validity: `scientifically_unknown`
- Dominant failure domain: `projection_staleness`

## Experiment Runs

| Experiment tag | Run id |
| --- | --- |
| `v3_1_c1_gpt_4_1_bundle_5_random_l2` | `kx7dpbnws2kqt1rkd8bmyaz1gx83d8f3` |
| `v3_1_c1_gpt_5_2_bundle_5_random_l2` | `kx7cydpzenx4y9cm13ew4a09k583dfy0` |
| `v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2` | `kx70hcyv1g9epcg5xahn1ezdrs83d519` |
| `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2` | `kx78r2v6mzqhr2xr3jv4j6qs0h83c5zp` |
| `v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2` | `kx7fk424nxwtn105x4a7k6fmfd83c684` |
| `v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2` | `kx79bccmr2czdv79b073vx9vpn83dya4` |
| `v3_a1_gpt_4_1_abstain_false` | `kx71ajna0v46pbjqrh3skjd6y583cfj5` |
| `v3_a1_gpt_4_1_abstain_true` | `kx7b1byscevw08hvd4ft235cmh83cstj` |
| `v3_a1_gpt_5_2_abstain_false` | `kx73j8jhf9t1ana5gd5fm89tbn83cerm` |
| `v3_a1_gpt_5_2_abstain_true` | `kx70m3h3wt93ge048tgsder5q183d3ye` |
| `v3_a2_gpt_4_1_l3` | `kx779dd1ncjngykqn3b6rq8q8n83dycz` |
| `v3_a2_gpt_5_2_l3` | `kx711dqcgfepxfkgp857wjfk8x83dqnn` |
| `v3_a4_rubric_gpt_4_1_scoring_gpt_5_2` | `kx73dnkb91bh7f9sprpeespw0s83d8xm` |
| `v3_a4_rubric_gpt_5_2_scoring_gpt_4_1` | `kx715mw8mmwzaq06gzs95vp4tn83d9zr` |
| `v3_a5_gpt_4_1_illiberal_democracy` | `kx74fke6hrm6q2pk1ag0rzed1h83dnxr` |
| `v3_a5_gpt_5_2_illiberal_democracy` | `kx79kzsf38cqjvr0yv7zgwxqvh83c614` |
| `v3_d1_control_gpt_4_1` | `kx7e97rwgrrytz6kd4gvr03vax83c7az` |
| `v3_d1_control_gpt_5_2` | `kx79dvrekz9nkwdhmta7nnw8x183cvq7` |

## Failure Snapshot

- Temporal readiness at failure snapshot was healthy: both `judge-gym.run` and `judge-gym.window` were `ready`, with one active worker identity and no queue backlog.
- Snapshot `stuck_summary` was `10 x stale_projection`.
- The stale set was concentrated in `rubric_critic`, while newer runs had already advanced into `score_gen`.
- Local Convex dev logs earlier in the same pass also showed recovered `rubric_gen` parser retries, but those were historical attempt failures, not the dominant stall.

## Safe-Heal

- One bounded safe-heal pass was attempted with `packages/codex:controlProcessExecution` and `action="repair_bounded", operation="reproject_snapshot"` on the 10 stale runs from the captured snapshot.
- Immediate outcome: the stale set dropped from `10` to `6`, then briefly to `0`.
- Final outcome after settle: the cohort relapsed to `stalled_recoverable`.

## Post-Heal Evidence

- Representative run `kx74fke6hrm6q2pk1ag0rzed1h83dnxr` remained in `score_gen` with `0/600` score targets completed.
- `packages/codex:listBatchReconciliationStatus` for that run showed two failed batch chunks:
  - `500` items, `status=failed`, `provider_batch_id=null`
  - `100` items, `status=failed`, `provider_batch_id=null`
- Both chunks failed with the same message:
  - `Timed out preparing batch execution for score_gen run kx74fke6hrm6q2pk1ag0rzed1h83dnxr`
- The freshest trace event on that run after safe-heal was a `stage_activity_heartbeat` from `source=batch_preamble`, `step=recover_batch_execution`, not a batch submission/apply event.

## Interpretation

- The current heartbeat hardening is still missing at least one high-latency preflight segment in run-stage execution.
- The strongest live evidence now points at the score-stage batch preamble path around attempt-start fanout plus `ensureBatchExecution`/recovery, not only the direct-request path.
- Because the cohort required safe-heal and then relapsed with explicit batch-prep timeout evidence, this pass should be treated as `patch_required`, not as a successful autonomous loop.

## Chosen Patch Hypothesis

- Harden run-stage preflight liveness around score-stage batching by emitting heartbeats and/or extending bounded timeout coverage across the full batch-attempt start plus `ensureBatchExecution`/recovery segment.
- Preserve batch observability so failed preamble chunks remain attributable in `llm_batch_executions`.
- Secondary follow-up: capture assistant output for apply-time parser failures so rubric contract misses stop being blind forensic gaps.

## Validation Outcome

- Pending patch.
- Commit hash: none yet.
