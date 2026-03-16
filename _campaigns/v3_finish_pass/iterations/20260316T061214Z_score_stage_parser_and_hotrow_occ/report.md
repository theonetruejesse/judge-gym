# V3 Finish Pass Iteration 20260316T061214Z_score_stage_parser_and_hotrow_occ

- Manifest version: `1`
- Launch mode: `full` (`target_count=30`, `pause_after=null`)
- Expected cohort size: `22` experiments
- Observed campaign state: `scientifically_invalid`
- Scientific validity: `scientifically_invalid_parser`
- Dominant failure domain: `artifact_apply`
- Secondary domains: `parser_contract`, `observability_blind_spot`
- Safe-heal attempted: `no`

## Summary

The current full dev pass progressed well past the previous heavy-family handoff failure. Most `600`-target families are now in `score_gen` or `score_critic`, which validates the earlier score-stage handoff patch.

The new failures are score-stage specific:

1. Score parsing is too strict. Many otherwise valid outputs end with bullet-prefixed final lines like `- VERDICT: <token>`, which `parseSingleVerdict` / `parseSubsetVerdict` reject because the verdict regex only matches lines that begin directly with `VERDICT:`.
2. Score apply still has a hot-row collision on `sample_score_targets`. Representative requests are failing with repeated OCC conflicts during `applyRequestResult`, which points to score-target row patching remaining in the score-stage hot path.
3. `packages/codex:getV3CampaignStatus` itself now exceeds Convex's document-read cap on this hotter cohort, so the control-plane observability surface is falling behind the engine.

## Lightweight Cohort Snapshot

The main control-plane status query failed due to read pressure, so the cohort snapshot below comes from a targeted one-off query over latest V3 runs:

- Latest runs: `22`
- Status counts:
  - `running`: `16`
  - `completed`: `5`
  - `error`: `1`
- Stage counts:
  - `rubric_gen`: `1`
  - `score_gen`: `3`
  - `score_critic`: `18`

## Representative Run Evidence

- Experiment tag: `v3_a1_gpt_4_1_abstain_false`
- Run id: `kh7dss3z45phxgy23r2jppvcbn830k1a`
- Current stage: `score_critic`
- Artifact counts:
  - `samples=30`
  - `rubrics=30`
  - `rubric_critics=30`
  - `sample_score_targets=600`
  - `scores=600`
  - `score_critics=400`
- Request counts:
  - `total=1169`
  - `historical_error=206`
  - `terminal_failed_targets=0`

Representative error classes in the same run:

- Score parser contract:
  - `Failed to parse verdict line ... - VERDICT: <token>`
- Score apply OCC:
  - `terminal:orchestrator_error:Documents read from or written to the "sample_score_targets" table changed while this mutation was being run and on every subsequent retry`

## Assessment

This pass is scientifically invalid and should not be used as a final result. The engine has clearly moved forward: score stages are now reached and progressing. But the next patch must address score-stage stability before another clean loop:

1. Accept bullet-prefixed verdict lines in the score parsers.
2. Remove or defer the score-stage `sample_score_targets` hot-row patch from the apply hot path.
3. Reduce the control-plane status read volume so live V3 monitoring keeps working once score stages become hot.

## Validation

- Validation outcome: `pending`
- Commit hash: `pending`
