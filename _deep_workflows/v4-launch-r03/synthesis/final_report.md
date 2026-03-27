# Final Report: V4 Launch R03

## Objective

Launch the remaining locked headline conditions after the baseline cohort: cross-provider abstention and Gilardi l2_neutralized, using the hardened tag policy and the same monitored promotion/prune loop.

## Workflow Summary

- Objective class: live_launch
- Operating mode: live_ops_with_patch
- Execution mode: compile_and_execute

## Findings

- Launched the remaining 12 headline cells after the baseline cohort: 8 abstention experiments across Gilardi and Zheng, plus 4 Gilardi `l2_neutralized` experiments across the full provider panel.
- The first attempt to launch the Gilardi `l2_neutralized` cohort surfaced a real precondition gap rather than a runtime failure: the headline evidence set did not yet have `l2_neutralized` semantic views. A targeted transform run generated the missing views for all 24 Gilardi headline items, after which the cohort launched cleanly.
- All 12 headline runs completed on own-dev + Railway. The abstention cohort completed with zero failures across `gpt-4.1`, `gpt-5.2`, `claude-sonnet-4`, and `qwen-current-text-flagship` for both Gilardi and Zheng.
- The Gilardi `l2_neutralized` cohort initially completed with one dirty edge: `gilardi_relevance_v1_view_l2_neutralized_claude_sonnet4` hit a parser failure on one score target when Claude returned a prose-leading freeform label response (`This article is relevant ...`) instead of a bare label token.
- Patched `freeform_label_choice` to recover mapped labels anywhere in the final line before falling back to first-token parsing, validated the change, and reran only the affected Claude experiment. The rerun completed with all 24/24 score targets and 0 failures.
- After the parser fix and rerun, the full locked wave-1 headline matrix is now live-complete on own-dev: 20 experiments total, each with a clean latest run and no active queue backlog.

## Decisions

- Treat semantic-view coverage as part of the launch contract for view-sensitive cohorts; generate the transform coverage before live launch instead of trying to recover mid-run.
- Promote mapped-label recovery in `freeform_label_choice` as a permanent compatibility hardening for paper-audit tasks, because mild provider formatting drift should not sink an otherwise valid label response.
- Consider the headline launch pass operationally successful once the Claude `l2` rerun replaced the dirty latest run with a clean completion and queue health returned to idle.

## Validation

- `bun run v4:build:headline`
- `bun run v4:launch:headline --cohort=abstention`
- `bun run v4:launch:headline --cohort=abstention --live --start-run`
- Generated missing Gilardi semantic views with `packages/evidence_transform.js:createEvidenceTransformRun`, `packages/evidence_transform.js:startEvidenceTransformRun`, and verified full `l2_neutralized` coverage with `packages/evidence_transform.js:getEvidenceSetTransformCoverage`
- `bun run v4:launch:headline --cohort=gilardi_l2 --live --start-run`
- `cd apps/engine-convex && bun run test -- run_parsers`
- `bun run validate:convex`
- Reran the affected experiment with `packages/lab:startExperimentRun` on `gilardi_relevance_v1_view_l2_neutralized_claude_sonnet4`
- Verified with `packages/lab:listExperiments` that all 12 `R03` cells reached `completed` and that every latest run is now failure-free
- Verified with `packages/codex:getTemporalTaskQueueHealth` that the `judge-gym.run` queue is healthy and idle after the cohort
