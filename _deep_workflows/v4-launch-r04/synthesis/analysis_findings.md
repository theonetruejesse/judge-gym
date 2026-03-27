# V4 R04 Analysis

## First-Pass Findings

- Best paper-relative agreement: `gilardi_relevance_v1_baseline_gpt52` at 100.0%.
- Weakest paper-relative agreement: `zheng_mt_bench_pair_v2_v1_baseline_gpt41` at 76.9%.
- Zheng tie usage in the baseline panel: `gpt-4.1`=0, `gpt-5.2`=0, `claude-sonnet-4`=0, `qwen-current-text-flagship`=0.
- Gilardi raw vs `l2_neutralized` flip rate for `gpt-4.1`: 4.2%.
- Gilardi raw vs `l2_neutralized` flip rate for `gpt-5.2`: 4.2%.
- Gilardi raw vs `l2_neutralized` flip rate for `claude-sonnet-4`: 20.8%.
- Gilardi raw vs `l2_neutralized` flip rate for `qwen-current-text-flagship`: 12.5%.

## Experiment Summary

| Experiment | Agreement | Abstain | Entropy | Labels |
| --- | ---: | ---: | ---: | --- |
| `gilardi_relevance_v1_abstention_on_claude_sonnet4` | 79.2% | 0.0% | 1.00 | Irrelevant:12, Relevant:12 |
| `gilardi_relevance_v1_abstention_on_gpt41` | 91.7% | 0.0% | 0.95 | Irrelevant:9, Relevant:15 |
| `gilardi_relevance_v1_abstention_on_gpt52` | 100.0% | 0.0% | 0.87 | Irrelevant:7, Relevant:17 |
| `gilardi_relevance_v1_abstention_on_qwen` | 91.7% | 0.0% | 0.95 | Irrelevant:9, Relevant:15 |
| `gilardi_relevance_v1_baseline_claude_sonnet4` | 79.2% | 0.0% | 1.00 | Irrelevant:12, Relevant:12 |
| `gilardi_relevance_v1_baseline_gpt41` | 91.7% | 0.0% | 0.95 | Irrelevant:9, Relevant:15 |
| `gilardi_relevance_v1_baseline_gpt52` | 100.0% | 0.0% | 0.87 | Irrelevant:7, Relevant:17 |
| `gilardi_relevance_v1_baseline_qwen` | 95.8% | 0.0% | 0.92 | Irrelevant:8, Relevant:16 |
| `gilardi_relevance_v1_view_l2_neutralized_claude_sonnet4` | 91.7% | 0.0% | 0.87 | Irrelevant:7, Relevant:17 |
| `gilardi_relevance_v1_view_l2_neutralized_gpt41` | 87.5% | 0.0% | 0.92 | Irrelevant:8, Relevant:16 |
| `gilardi_relevance_v1_view_l2_neutralized_gpt52` | 95.8% | 0.0% | 0.81 | Irrelevant:6, Relevant:18 |
| `gilardi_relevance_v1_view_l2_neutralized_qwen` | 91.7% | 0.0% | 0.87 | Irrelevant:7, Relevant:17 |
| `zheng_mt_bench_pair_v2_v1_abstention_on_claude_sonnet4` | 76.9% | 0.0% | 0.89 | A:9, B:4 |
| `zheng_mt_bench_pair_v2_v1_abstention_on_gpt41` | 76.9% | 0.0% | 0.96 | A:8, B:5 |
| `zheng_mt_bench_pair_v2_v1_abstention_on_gpt52` | 76.9% | 0.0% | 0.78 | A:10, B:3 |
| `zheng_mt_bench_pair_v2_v1_abstention_on_qwen` | 76.9% | 0.0% | 0.96 | A:8, B:5 |
| `zheng_mt_bench_pair_v2_v1_baseline_claude_sonnet4` | 76.9% | 0.0% | 0.96 | A:8, B:5 |
| `zheng_mt_bench_pair_v2_v1_baseline_gpt41` | 76.9% | 0.0% | 0.89 | A:9, B:4 |
| `zheng_mt_bench_pair_v2_v1_baseline_gpt52` | 76.9% | 0.0% | 0.78 | A:10, B:3 |
| `zheng_mt_bench_pair_v2_v1_baseline_qwen` | 76.9% | 0.0% | 0.89 | A:9, B:4 |

## Cross-Provider Disagreement

- `gilardi` / `baseline` disagreement rate: 20.8% over 24 items.
- `gilardi` / `abstention_on` disagreement rate: 20.8% over 24 items.
- `gilardi` / `view_l2_neutralized` disagreement rate: 8.3% over 24 items.
- `zheng` / `baseline` disagreement rate: 15.4% over 13 items.
- `zheng` / `abstention_on` disagreement rate: 15.4% over 13 items.

## Immediate Interpretation

- Zheng baseline still shows full tie suppression across the entire provider panel, not just in the GPT-4.1 canary.
- The strongest Gilardi view sensitivity is on `claude-sonnet-4` with a 20.8% raw-vs-`l2` label flip rate.
- The largest baseline-vs-abstention movement was on `zheng` / `gpt-4.1` at 7.7%.
