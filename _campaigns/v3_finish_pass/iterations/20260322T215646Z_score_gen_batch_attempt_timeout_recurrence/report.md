# V3 Iteration Report: 20260322T215646Z_score_gen_batch_attempt_timeout_recurrence

- Manifest version: `2`
- Launch mode: `full`
- Expected cohort: `18` manifest-tagged experiments
- Observed cohort at terminal snapshot: `18/18` latest runs bound, `18` in `error`, `18` in `score_gen`
- Campaign status at captured snapshot: `scientifically_invalid`
- Scientific validity: `scientifically_invalid`
- Dominant failure domain: `stage_activity`

## Experiment Runs

| Experiment tag | Run id |
| --- | --- |
| `v3_1_c1_gpt_4_1_bundle_5_random_l2` | `kx74z0v86fw8mmty27q44h3zpd83djhf` |
| `v3_1_c1_gpt_5_2_bundle_5_random_l2` | `kx7dtd1h8c243qx1xpzbr45jd983cm6n` |
| `v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2` | `kx7ewcww319mmkc3dhr3gmmch983ccd6` |
| `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2` | `kx75dhggsadwe7kj3rtfahgj9583cgz8` |
| `v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2` | `kx71bahycv64rr66h5ay0qv3hh83c83t` |
| `v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2` | `kx75a575cgmc06w9fnbbnvf9q583dkan` |
| `v3_a1_gpt_4_1_abstain_false` | `kx79rnmhjxzdxejhbvns174fm983d6gf` |
| `v3_a1_gpt_4_1_abstain_true` | `kx71v6hr202qd08frbdz1t6xw183dbrg` |
| `v3_a1_gpt_5_2_abstain_false` | `kx75g22yhew1m79yz2cwe2hywh83cvet` |
| `v3_a1_gpt_5_2_abstain_true` | `kx7cpxk2yemkttc8d3vgzzwda583cav9` |
| `v3_a2_gpt_4_1_l3` | `kx71btea58d99n56ad72yqvg5n83cpfz` |
| `v3_a2_gpt_5_2_l3` | `kx78varxzf695jh44qhgy6txqh83cpj0` |
| `v3_a4_rubric_gpt_4_1_scoring_gpt_5_2` | `kx7bxavjmhgmqnn88r5rc99gt983c6j0` |
| `v3_a4_rubric_gpt_5_2_scoring_gpt_4_1` | `kx7a6wwvrch4y7v4jk8nk8wrch83ce2z` |
| `v3_a5_gpt_4_1_illiberal_democracy` | `kx71qwhvgeaqf47hdev3m94h6x83c4ke` |
| `v3_a5_gpt_5_2_illiberal_democracy` | `kx7a7pk172bf96e0n7xrbbgrf983dn83` |
| `v3_d1_control_gpt_4_1` | `kx7bq68qkzsft6mec7aht2zv3s83d2vd` |
| `v3_d1_control_gpt_5_2` | `kx779hegcq70mssvk41y1t16zs83drz4` |

## Failure Snapshot

- Temporal readiness at the terminal snapshot was healthy: both `judge-gym.run` and `judge-gym.window` were `ready`, with one active worker identity (`1@57c4e8d4aaeb`) and no queue backlog.
- `stuck_summary` was empty. This pass did not fail by drift or stale projection; it failed explicitly at the run workflow/activity layer.
- Both workload families were affected:
  - all `6` 120-target bundle runs
  - all `12` 600-target scoring runs
- Terminal campaign snapshot showed `18` runs in `score_gen`, all `18` with run status `error`, and `0` completed score targets across the cohort.

## Representative Evidence

- Representative 600-target run `kx79rnmhjxzdxejhbvns174fm983d6gf`:
  - `packages/codex:getProcessHealth` ended with repeated `llm_attempt_started` events in `score_gen`
  - `packages/codex:listBatchReconciliationStatus` showed `attempt_counts.started=192`, `attempt_counts.succeeded=0`, `attempt_counts.failed=0`, and `batch_count=0`
  - `packages/codex:inspectProcessExecution` showed Temporal `executionStatus=failed`, `stage=score_gen`, `lastErrorMessage="Activity task failed"`
- Representative 120-target run `kx74z0v86fw8mmty27q44h3zpd83djhf` showed the same shape with `attempt_counts.started=80`, `batch_count=0`, and a failed `score_gen` workflow.
- Railway worker logs for deployment `a41e6ac2-f67e-4f58-be84-2216fa2330d6` exposed the missing cause that Convex surfaces did not:
  - `Error: Timed out recording batch attempts for score_gen run ...`
  - this repeated across both 120-target and 600-target runs, including the four workflows that were still "running" at the first failure snapshot and later converged to `error`

## Safe-Heal

- No safe-heal was attempted on this pass.
- Reason: the failure was already explicit, widespread, and scientifically invalid. A bounded reproject/resume could not turn this into a trustworthy continuation because the underlying worker activity was failing cohort-wide in `score_gen`.

## Interpretation

- The previous score-stage hardening in `8068cb0` changed the symptom profile, but it did not fully remove the score-stage preamble timeout.
- The dominant remaining failure is now narrower and clearer:
  - the run enters `score_gen`
  - many `recordLlmAttemptStart` writes succeed
  - no `llm_batch_executions` row is ever created
  - the workflow fails with `Timed out recording batch attempts for score_gen run ...`
- Because `batch_count=0` across representative failures, the remaining choke point is still before batch registration/provider submission, not provider polling or output apply.

## Chosen Patch Hypothesis

- Make score-stage batch attempt recording resumable and page-based instead of one bounded activity segment.
- Persist batch execution ownership earlier in the preamble, then record attempt-start rows in explicit small pages with heartbeat coverage and continuation state so retries can resume instead of replaying a large fanout.
- Keep the batch reconciliation surface truthful even when pre-batch preparation fails before provider batch creation.

## Validation Outcome

- Pending patch.
- Launch commit hash: `1ffbe200a4cbbbd5eb2c590324e856d6274746d2`
