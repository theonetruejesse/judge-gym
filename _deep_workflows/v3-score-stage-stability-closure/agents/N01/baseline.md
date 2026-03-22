Cohort snapshot (iteration `20260322T215646Z_score_gen_batch_attempt_timeout_recurrence`):
- `effective_campaign_state`: scientifically_invalid
- `launch_ready`: false
- `status.counts.error`: 18 (all experiment runs)
- `stage_distribution`: 18 in `score_gen`, 0 in other stages
- Temporal queues: both run/window ready with a single worker identity `1@57c4e8d4aaeb` and zero backlog

Representative runs sharing the failure shape:
- 120-target bundle `kx74z0v86fw8mmty27q44h3zpd83djhf` (experiment `v3_1_c1_gpt_4_1_bundle_5_random_l2`)
- 600-target scoring run `kx79rnmhjxzdxejhbvns174fm983d6gf` (experiment `v3_a1_gpt_4_1_abstain_false`)
  Both runs reached `score_gen`, recorded many `llm_attempt_started` events, but `llm_batch_executions.batch_count` remained `0` before Temporal closed the workflow as `failed`.

Dominant worker-side timeout message observed:
`Error: Timed out recording batch attempts for score_gen run <run_id>`.
This string appears across the Railway logs for both 120-target and 600-target runs and matches the process-level `withPreflightGuard` rejection in the Temporal worker.
