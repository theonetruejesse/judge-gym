# V3 Finish Pass Iteration Report

- Iteration: `20260322T011900Z_full_pass_subset_parser_invalid`
- Manifest version: `2`
- Launch mode: `full`
- Commit at observation: `0ddef47`
- Scientific validity: `scientifically_invalid`
- Dominant failure domain: `artifact_apply`

## Cohort

- Experiment tags: 18 explicit V3 tags from `_campaigns/v3_finish_pass/manifest.json`
- Observed counts at capture:
  - completed: `18`
  - running: `0`
  - errored: `0`
  - runs with failures: `1`

## Observed State

- Campaign snapshot after Railway worker redeploy:
  - `effective_campaign_state = scientifically_invalid`
  - Temporal queues healthy
  - all runs completed
- The single failed cohort member:
  - experiment: `v3_a2_gpt_5_2_l3`
  - run: `kx7btwjsqzf5y6wyydbvxxe2z583asw2`
  - completed samples: `29 / 30`
  - terminal failed score targets: `3`

## Root Cause

The remaining blocker is a subset-verdict parser contract bug, not worker readiness:

- `score_gen` produced outputs whose verdict lines included multiple stage identifiers on one line.
- The parser rejected those outputs with errors like:
  - `Unrecognized verdict label: VcGZj, dqqCdj`
  - `Failed to parse verdict line ... VERDICT: ThKMhJ, vcPIJZ`
- `score_critic` was then correctly blocked for those failed score targets.

## Conclusion

The hardening pass worked: the cohort now finishes reliably and the queues stay healthy. The next patch should target the subset score parser so multi-label verdict lines are handled according to the intended contract before the next clean reset/start.
