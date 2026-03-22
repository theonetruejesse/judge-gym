# Iteration 20260322T183004Z Score Stage Projection Recurrence

- Manifest version: `2`
- Launch mode: `full`
- Base HEAD: `0f73135`
- Expected cohort: `18` experiments from `_campaigns/v3_finish_pass/manifest.json`
- Observed cohort at capture: `18` latest runs bound, `18` running, `0` completed, `0` errors
- Observed stage distribution at capture: `10 rubric_critic`, `8 score_gen`
- Cohort status from snapshot: `stalled_recoverable`
- Scientific validity judgment: `scientifically_invalid`
- Dominant failure domain: `projection_staleness`
- Safe-heal attempted after capture: `yes`
- Validation outcome: `local Temporal tests passed, root typecheck passed, Railway deploy 565cc726-ffe2-4ef1-8b97-bcc6e08dd4d1 succeeded, live cohort remains preflight_clean`
- Chosen patch hypothesis: active runs are going stale before the existing request/batch-wait heartbeat wrappers begin; the shared choke point is the run-stage preflight path (`quota.reserve` for direct + batch, plus `ensureBatchExecution` for batch) after attempts are started but before provider work or batch polling begins.

## Launch Set

- `v3_1_c1_gpt_4_1_bundle_5_random_l2` -> `kx73px5nqt1gt1s7prwsyv0zwn83cmej`
- `v3_1_c1_gpt_5_2_bundle_5_random_l2` -> `kx7b18t8t9aefk1170f6zr61s183cdhz`
- `v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2` -> `kx798gbtsk34eg3vv90xx02x7183cs6r`
- `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2` -> `kx7casnas2c1enf461ryy2bvzd83c1wy`
- `v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2` -> `kx75jn8ge7xv9266jvf1kap6kn83ceds`
- `v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2` -> `kx74jcq1d2faezyar6xe89k1js83cgb5`
- `v3_a1_gpt_4_1_abstain_false` -> `kx7b7ak5j376kv71mqtbjks7y983d0x1`
- `v3_a1_gpt_4_1_abstain_true` -> `kx7851c9wrqp1w4xfph6f7z5ex83d1jp`
- `v3_a1_gpt_5_2_abstain_false` -> `kx7e5grz61kqgsptm7znkzfgmd83c3sm`
- `v3_a1_gpt_5_2_abstain_true` -> `kx70xjz2e1mhxwjf5mh6kkw9f183dvpq`
- `v3_a2_gpt_4_1_l3` -> `kx7artcv279hqc6nadrzyj5ac183df5k`
- `v3_a2_gpt_5_2_l3` -> `kx7885cm1db6jf6mng3ed53mkd83dd8y`
- `v3_a4_rubric_gpt_4_1_scoring_gpt_5_2` -> `kx75mrb6vc90mpzh0psq32kdgn83cz19`
- `v3_a4_rubric_gpt_5_2_scoring_gpt_4_1` -> `kx7bv89vbcyaaej5jpqaw3gyjs83cyq0`
- `v3_a5_gpt_4_1_illiberal_democracy` -> `kx70e1zqq65xdrda5jh45ctjcd83d5dp`
- `v3_a5_gpt_5_2_illiberal_democracy` -> `kx7a4bnzca9y04ph8w3gb7f8tx83ctdy`
- `v3_d1_control_gpt_4_1` -> `kx76ax5nh0bqhqzcyw72d42hnn83d73k`
- `v3_d1_control_gpt_5_2` -> `kx709krrmgjcb432njhh3hrw4183cg2y`

## Temporal Readiness

- Run queue `judge-gym.run`: ready, one workflow poller and one activity poller on worker identity `1@cef77b7ce4be`, zero backlog
- Window queue `judge-gym.window`: ready, one workflow poller and one activity poller on worker identity `1@cef77b7ce4be`, zero backlog
- `blocked_task_queues = []`

## Key Evidence

- `9` stuck items, all `reason = stale_projection`
- Representative score-stage diagnostics:
  - `kx73px5nqt1gt1s7prwsyv0zwn83cmej` has `120` score targets, `120` attempts started, `0` succeeded, and a submitted batch `batch_69c0352dfb108190872ce6ddd0bd3ee1`
  - `kx7artcv279hqc6nadrzyj5ac183df5k` has `600` score targets, `600` attempts started, `0` succeeded, and two submitted batches sized `500 + 100`
- Representative rubric-stage diagnostics:
  - `kx7b18t8t9aefk1170f6zr61s183cdhz` remains in `rubric_critic` with `28/30` completed and no recorded failures
- Trace evidence:
  - score-stage trace `run:kx73px5nqt1gt1s7prwsyv0zwn83cmej` contains a fresh `stage_activity_heartbeat` with payload `{\"source\":\"batch_wait\",\"model\":\"gpt-4.1\",\"item_count\":120,\"batch_key\":\"h_95201a91\"}`
  - despite that fresh heartbeat, the manifest-scoped campaign snapshot remained `stalled_recoverable`

## Expected vs Observed

- Expected: active score-stage batches or direct work should keep process freshness current enough for the cohort to remain `healthy_progressing`
- Observed: Temporal workflows and provider batches remain live, but campaign status still degrades to `stalled_recoverable` on stale process projection

## Safe-Heal Result

- Per protocol, one bounded `repair_bounded` / `reproject_snapshot` pass was attempted after the snapshot was written
- The first reproject sweep reduced the cohort from `9` stale runs to `1`
- One targeted remainder reproject on `kx7bv89vbcyaaej5jpqaw3gyjs83cyq0` returned the cohort to `healthy_progressing`
- Outcome: the live pass was recoverable without reset, but not yet self-sustaining because the stale condition recurred under normal full-loop load

## Patch + Redeploy

- Local diagnosis after the relapse showed that representative stale score runs had already created `operation_type = "batch"` attempts, but never reached the later `batch_wait` heartbeat path.
- Fresh trace evidence on the bad `gpt-5.2` score runs ended at `llm_attempt_started`, with no subsequent `batch_submitted`, `batch_polled`, or `stage_activity_heartbeat` events.
- The patch adds run-stage preflight heartbeats plus a bounded `llm.preflightTimeoutMs` around:
  - direct `quota.reserve`
  - batch `quota.reserve`
  - batch `ensureBatchExecution`
- Added targeted regressions for direct and batch preflight stalls in `apps/engine-temporal/src/mocha/run-service.test.ts`.
- Local validation passed:
  - `cd apps/engine-temporal && bun run test`
  - `bun run typecheck`
- Railway deployment `565cc726-ffe2-4ef1-8b97-bcc6e08dd4d1` succeeded at `2026-03-22T19:01:02.659Z`.
- Post-deploy live verification:
  - manifest-scoped campaign snapshot is back to `preflight_clean`
  - `launch_ready = true`
  - all 18 experiments remain in `start`
  - Temporal queues are ready with zero backlog on the new worker identity `1@8ca2e1f3c6ee`

## Follow-Up Blocker

- Local `convex dev` failure logs around `2026-03-22 14:02` also show repeated cleanup-race errors after destructive resets:
  - `packages/worker:recordLlmAttemptFinish -> Attempt not found`
  - `packages/worker:projectProcessState -> Window run not found`
- These look like late workflow callbacks arriving after run/window rows were deleted, which is separate from the score-stage freshness bug.
- Before the next V3 relaunch, the control plane should either stop deleting rows before callbacks are impossible, or the worker-side Convex mutations should degrade these missing-row cases to safe no-ops with traceable diagnostics instead of noisy hard failures.
