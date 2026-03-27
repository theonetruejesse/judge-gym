# Final Report: V4 Launch R04

## Objective

Analyze the first clean pass of the full 20-cell V4 headline matrix, summarize the most important geometry/provider findings, and define the monitored rerun or promotion policy for follow-on launch work.

## Workflow Summary

- Objective class: analysis_and_promotion
- Operating mode: read_only_with_local_analysis
- Execution mode: compile_and_execute

## Findings

- Exported and analyzed the first clean pass of the full 20-cell headline matrix directly from `packages/analysis:*` on own-dev, then joined those response rows against the local Gilardi and Zheng build bundles to recover paper-relative truth labels.
- The cleanest top-line result is that Zheng tie suppression generalizes across the full provider panel: all four baseline providers produced zero `C` / tie outputs on the 13-item slice.
- The abstention intervention is currently behaviorally weak on this matrix. Across all 20 experiments and 392 scored items, observed abstain count was exactly zero.
- Gilardi is where the interesting movement lives. `gpt-5.2` baseline reached 100% agreement against the imported majority/unanimous labels, while `claude-sonnet-4` baseline was much lower at 79.2%.
- The strongest semantic-view effect is `claude-sonnet-4` on Gilardi: baseline vs `l2_neutralized` flips 5/24 labels (20.8%) and improves paper-relative agreement by 12.5 points. Qwen also moves materially (12.5% flip rate), while both OpenAI models only move 1/24 items each.
- Cross-provider disagreement on Gilardi drops from 20.8% on the raw/baseline view to 8.3% on `l2_neutralized`, which is an unexpectedly strong “semantic smoothing” signal for the provider panel.
- Abstention-on still changes some labels without producing overt abstains. The only nonzero baseline-vs-abstention movements are:
  - Gilardi / Qwen: 1/24 items
  - Zheng / GPT-4.1: 1/13 items
  - Zheng / Claude Sonnet 4: 1/13 items
  - Zheng / Qwen: 1/13 items
  - `gpt-5.2` stays unchanged on both targets
- The most concrete changed examples are:
  - `claude-sonnet-4` flips five Gilardi items from `Irrelevant -> Relevant` under `l2_neutralized`; four of those flips move toward the imported truth label.
  - `gpt-4.1` on Zheng changes exactly one item under abstention, and that item’s imported winner is a tie, so the movement is not obviously an improvement.

## Decisions

- Do not rerun the full 20-cell headline matrix immediately. The first pass is coherent enough to prune the repeat budget down to the cells that actually move or anchor the main claims.
- Treat `gpt-5.2` as the current stability anchor. It is the strongest Gilardi baseline performer and shows zero baseline-vs-abstention movement on either target.
- Promote a targeted 12-run rerun cohort:
  - Gilardi `baseline` and `view_l2_neutralized` for `gpt-4.1`, `claude-sonnet-4`, and `qwen-current-text-flagship`
  - Zheng `baseline` and `abstention_on` for `gpt-4.1`, `claude-sonnet-4`, and `qwen-current-text-flagship`
- Defer full-panel abstention repeats. The current abstention contract should be treated as a negative or weak-effect finding unless a follow-on translated prompt makes abstention behaviorally active.
- Preserve `gpt-5.2` as an analysis anchor rather than spending immediate rerun budget there.

## Validation

- Generated the full 20-tag matrix list from `scripts/v4/headline_matrix.ts`
- Queried manifests and paginated response rows directly through `./scripts/run_convex.sh packages/analysis:*`
- Wrote machine-readable summaries to `_deep_workflows/v4-launch-r04/runtime/headline_analysis.json`
- Wrote human-readable findings to `_deep_workflows/v4-launch-r04/synthesis/analysis_findings.md`
- Cross-checked local truth labels against:
  - `_local/v4_builds/gilardi/headline_bundle.json`
  - `_local/v4_builds/zheng/headline_bundle.json`
- Recomputed the analysis after fixing an item-identity bug in the local workflow script so Zheng joins use the frozen evidence label (`E1`, `E2`, ...) instead of non-unique titles
