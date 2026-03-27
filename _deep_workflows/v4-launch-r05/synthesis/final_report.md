# Final Report: V4 Launch R05

## Objective

Execute the GPT-4.1-only targeted rerun cohort for V4: rerun Gilardi baseline and l2 plus Zheng baseline and abstention, then compare the reruns against the first-pass outputs.

## Workflow Summary

- Objective class: rerun_and_compare
- Operating mode: live_ops_with_patch
- Execution mode: compile_and_execute

## Findings

- Executed the budget-constrained GPT-4.1 rerun cohort as four fresh live runs:
  - `gilardi_relevance_v1_baseline_gpt41`
  - `gilardi_relevance_v1_view_l2_neutralized_gpt41`
  - `zheng_mt_bench_pair_v2_v1_baseline_gpt41`
  - `zheng_mt_bench_pair_v2_v1_abstention_on_gpt41`
- All four reruns completed cleanly with zero failures and healthy queue telemetry.
- `Gilardi` baseline is fully stable for GPT-4.1: the rerun matched the original baseline exactly, 24/24 item labels unchanged.
- `Zheng` abstention is also fully stable for GPT-4.1: the rerun matched the original abstention run exactly, 13/13 item labels unchanged.
- `Gilardi` `l2_neutralized` is almost stable but not perfectly deterministic: 1/24 items flipped between the first pass and the rerun. The changed item was `E20`, which moved `Irrelevant -> Relevant`.
- `Zheng` baseline is also almost stable but not perfectly deterministic: 1/13 items flipped between the first pass and the rerun. The changed item was `E8`, which moved `A -> B`; the imported benchmark label for that item is a tie, so this looks like a boundary case rather than a clean directional reversal.
- The most important consequence is that the first-pass GPT-4.1 baseline-vs-abstention difference on Zheng does **not** survive the rerun as a stable regime effect. After rerun, GPT-4.1 baseline and GPT-4.1 abstention land on the same label distribution (`A:8, B:5`) for the 13-item slice.

## Decisions

- Promote the GPT-4.1 `Gilardi` baseline result as stable.
- Treat the GPT-4.1 `Gilardi` raw-vs-`l2_neutralized` effect as real enough to keep, but describe it as a low-grade semantic sensitivity rather than a perfectly repeatable item set.
- Treat the GPT-4.1 `Zheng` abstention effect from the first pass as unstable/noisy, not as a headline mechanism result.
- Preserve the stronger first-pass claims from `R04`:
  - Zheng tie suppression remains real
  - abstention remains weak on this matrix
  - Gilardi semantic-view sensitivity remains the most substantive intervention surface
- Do not spend more immediate budget on additional GPT-4.1 repeats unless we specifically want to resolve the single `Gilardi l2` boundary item or the single tie-adjacent Zheng baseline item.

## Validation

- Started 4 live reruns through `packages/lab:startExperimentRun`
- Monitored completion through `packages/lab:listExperiments`
- Compared the newest completed runs against the immediately preceding completed runs with `_deep_workflows/v4-launch-r05/runtime/compare_gpt41_reruns.py`
- Wrote machine-readable comparison output to `_deep_workflows/v4-launch-r05/runtime/rerun_comparison.json`
- Wrote human-readable comparison output to `_deep_workflows/v4-launch-r05/synthesis/rerun_findings.md`
