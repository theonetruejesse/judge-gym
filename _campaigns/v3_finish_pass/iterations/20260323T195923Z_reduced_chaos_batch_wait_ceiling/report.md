# V3 Finish Pass Iteration: 20260323T195923Z_reduced_chaos_batch_wait_ceiling

- Manifest version: `_campaigns/v3_finish_pass/manifest.json`
- Launch mode: `reduced_chaos_subset`
- Experiment tags launched:
  - `v3_a1_gpt_4_1_abstain_false`
  - `v3_a1_gpt_5_2_abstain_true`
  - `v3_a2_gpt_4_1_l3`
  - `v3_a4_rubric_gpt_5_2_scoring_gpt_4_1`
  - `v3_a5_gpt_4_1_illiberal_democracy`
  - `v3_d1_control_gpt_5_2`
  - `v3_1_c1_gpt_4_1_bundle_5_random_l2`
  - `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2`
  - `v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2`
- Run ids launched:
  - `kx768ymmhg3nz3ezkd9vz40nj183e9qt`
  - `kx77ncwnw63fdy0z1jek9qefa983f1fa`
  - `kx78ws5ycdhc2zt7csd630rdnh83fkb5`
  - `kx7eg0sg5nc1t2kqyhtf7bgzad83eb8m`
  - `kx751t8k4g1cdmx6kvh8txer6983fc8h`
  - `kx7fynr2549fawbcjf7g1kp46s83e0zv`
  - `kx7et85vvqezjtt9kgnh7ncgnx83f48s`
  - `kx77g4shrpk70vf6htrg6c6yx183f5q8`
  - `kx79afrs2e9crt096dwg2mp0ws83ft5z`

## Expected vs observed

- Expected:
  - reduced-load chaos validation should prove target-level retry budgeting under injected parser faults
  - unaffected work should continue progressing
  - after the temporary chaos commit is reverted, the clean runtime should be ready for one final non-chaos validation loop
- Observed:
  - retry semantics worked as intended on the injected-fault run `kx768ymmhg3nz3ezkd9vz40nj183e9qt`
  - the temporary chaos hook induced two retryable parse failures and the target retried correctly before the third attempt hit a real provider 500
  - the cohort still progressed through `rubric_gen`, `rubric_critic`, and into score stages
  - a separate live blocker surfaced: multiple score-stage runs failed because OpenAI batches remained alive past the internal `2h` wait cap

## Cohort status

- Final manifest-scoped snapshot: `scientifically_invalid`
- Counts:
  - `completed=3`
  - `error=6`
  - `latest_runs_with_failures=1`
  - `running=0`
  - `queued=0`
- Temporal readiness:
  - run/window queues both `ready=true`
  - no backlog
  - single active worker identity visible during the pass: `1@b7e3199f1587`
- Stuck summary:
  - none reported by `packages/codex:getV3CampaignSnapshot`
  - none reported by `packages/codex:getStuckWork`

## Dominant failure domain

- Primary failure domain: `provider_or_quota`
- Scientific validity: `scientifically_invalid`

Representative evidence:

- `kx7et85vvqezjtt9kgnh7ncgnx83f48s`
  - workflow/process failed in `score_gen`
  - terminal error: `OpenAI batch batch_69c179e27b948190ae7670f39aaa4f7e exceeded max wait of 7200000ms`
- `kx79afrs2e9crt096dwg2mp0ws83ft5z`
  - workflow/process failed in `score_gen`
  - terminal error: `OpenAI batch batch_69c17be197908190bfa35256ba821d88 exceeded max wait of 7200000ms`
- `kx768ymmhg3nz3ezkd9vz40nj183e9qt`
  - target-level retry budgeting worked
  - `rubric_gen` sample ordinal `2` shows `attempt_count=3`, `retry_count=2`
  - attempts 1 and 2 were injected parse faults; attempt 3 hit a real provider 500

## Safe-heal

- No safe-heal was attempted.
- The pass was allowed to drain naturally because Temporal queues remained healthy and the key objective was to observe the true terminal failure shape.

## Patch hypothesis

- The durable blocker is not the temporary chaos hook.
- The score-stage runtime still enforced `llm.batching.maxWaitMs = 2h`, while OpenAI batch requests use the provider's `24h` completion window.
- This created a settings mismatch where valid long-tail provider batches were treated as terminal workflow failures before the provider-side SLA window ended.

## Validation outcome

- Durable retry/forensics patch was already locally validated before this pass.
- Temporary chaos hook commit was reverted cleanly in `9469892`.
- Follow-up durable fix:
  - commit `52e3aab` (`Align batch wait budget with provider window`)
  - raises `llm.batching.maxWaitMs` to `24h`
  - raises `temporal.activityStartToCloseMs` to `26h`
- Local validation after the wait-budget patch passed:
  - `bun run typecheck`
  - `cd apps/engine-temporal && bun run test -- src/mocha/run-service.test.ts`

## Commit hashes

- Durable retry semantics / forensics: `28799af`
- Parse retry exhaustion regression: `6dbed45`
- Temporary chaos hook: `7847d65`
- Chaos hook revert: `9469892`
- Batch wait-budget alignment: `52e3aab`

## Next step

- Wait for Railway deployment `18ceb51e-a2f4-409d-8979-db8e1ffa9956` to finish promoting.
- Verify the live worker/queue state reflects the new `24h` wait budget runtime.
- Reset back to `preflight_clean`.
- Run the final non-chaos validation loop on the clean runtime.
