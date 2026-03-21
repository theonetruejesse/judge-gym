# V3 Finish Pass Iteration Report

- Iteration: `20260321T215833Z_score_stage_hardening_audit`
- Manifest version: `2`
- Launch mode: `full`
- Commit at observation: `133c586` + working-tree hardening patch
- Scientific validity: `scientifically_unknown`
- Dominant failure domain: `artifact_apply`

## Cohort

- Experiment tags: 18 explicit V3 tags from `_campaigns/v3_finish_pass/manifest.json`
- Expected counts:
  - experiments: `18`
  - target_count per experiment: `30`
  - pause_after: `null`
- Observed counts at capture:
  - running: `18`
  - paused: `0`
  - completed: `0`
  - error: `0`

## Observed State

- Campaign state from `packages/codex:getV3CampaignSnapshot`: `healthy_progressing`
- Temporal readiness:
  - `judge-gym.run`: ready
  - `judge-gym.window`: ready
- Stage distribution:
  - `score_gen`: `13`
  - `score_critic`: `5`
- Live concern during the pass:
  - completed OpenAI batches were outrunning persisted `scores`
  - worker logs showed late `projectProcessState` completions
  - the old cohort snapshot path still depended on broad scans under load

## Diagnosis

Three issues were confirmed in the repo/runtime boundary:

1. Batch-backed stages were too brittle after provider completion.
   - Stage activities were single-attempt.
   - OpenAI batch/file polling had no explicit transport retry budget.
   - Result: provider-complete work could strand before Convex apply finished.

2. `projectProcessState` timed out too aggressively under score-stage load.
   - Late completions then logged `Activity not found on completion`.
   - Result: stale projections and misleading health reads.

3. V3 campaign snapshot still did too much global work.
   - Status/readiness paths were broader than the explicit cohort needed.
   - Result: read-path timeouts during large score stages.

## Patch Set

- Added bounded stage retries via `packages/engine-settings`.
- Split projection activity timeout budget from the main stage activity timeout.
- Added explicit OpenAI batch/file transport retries.
- Scoped V3 experiment listing to the manifest tag set.
- Replaced global stuck-work reads with cohort-local `process_observability` checks.
- Fixed the local `debug:campaign` wrapper to resolve repo-root assets and Convex CLI correctly even when launched from `apps/engine-convex`.

## Validation Outcome

- Repo validation after patch:
  - `bun run validate:convex`
  - `bun run typecheck`
  - `cd apps/engine-temporal && bun run test`
- Live cohort at capture:
  - still progressing
  - queues healthy
  - no active stuck items

## Conclusion

This pass is a hardening iteration, not a reset/relaunch. The active full loop remains in flight, but the repo now has the missing retry/projection/status fixes needed before the next clean reset. One observability gap remains open: the agent still lacks a first-class chunk-level batch reconciliation view when completed provider batches lag persisted score artifacts.
