# Revised V4 Specs

## 1. Study Goal

V4 is a self-contained evaluator-regime audit paper. It uses literature-audit targets to show that evaluator behavior depends on the configured regime, and it carries forward only the V3 levers that remain meaningful under paper-faithful conditions.

Headline targets:

1. `Gilardi`
2. `Zheng / MT-Bench`

## 2. Provider Panel

### Headline Providers

- `gpt-4.1`
- `gpt-5.2`
- `claude-sonnet-4`
- `qwen_current_text_flagship`

### OpenRouter Freeze Rule

- resolve `qwen_current_text_flagship` to the latest stable text-only, non-thinking Qwen open-weight model available on OpenRouter at freeze time
- fallback: `qwen/qwen3-next-80b-a3b-instruct`

### Appendix / Watchlist Providers

- `gpt-4.1-mini`
- `gpt-5.2-chat`
- `deepseek/deepseek-v3.2`
- `z-ai/glm-4.5`
- `moonshotai/kimi-k2`
- `minimax/minimax-m1`
- `inception/mercury-2`

## 3. V3 Carry-Forward Policy

### Headline-Carried V3 Levers

- `d1` / faithful baseline
- `a1` / abstention toggle
- raw versus `l2_neutralized` evidence surface where fidelity survives

### Appendix-Carried V3 Levers

- `a3`, `c6`, `c7` / scale expansion
- `b1`, `c4`, `c5` / small-chat follow-ups

### Explicitly Not Carried Into The Headline

- `a4` / rubric-scoring placement
- `a5` / concept framing
- `c1`, `c2` / bundle strategy
- `a2`, `c3`, `l3` as a headline emphasis

## 4. Headline Matrix

| Target | Condition | Evidence View | Providers | Count |
|---|---|---|---|---:|
| `Gilardi` | `baseline_faithful` | `paper_original` if available, else `source_text` | all headline providers | 4 |
| `Gilardi` | `abstention_on` | same as baseline | all headline providers | 4 |
| `Gilardi` | `view_l2_neutralized` | `l2_neutralized` | all headline providers | 4 |
| `Zheng / MT-Bench` | `baseline_faithful` | `source_text` | all headline providers | 4 |
| `Zheng / MT-Bench` | `abstention_on` | same as baseline | all headline providers | 4 |

Headline total: **20 experiments**

## 5. Appendix Matrix

### OpenAI Internal Robustness

- `gpt-4.1-mini`
- `gpt-5.2-chat`

Conditions:

- faithful baseline
- abstention on

### Conditional Target Extensions

For `Zheng`:

- `view_l2_neutralized` if fidelity survives
- scale expansion if the output contract remains defensible

For later provider-family breadth:

- `DeepSeek V3.2`
- `GLM 4.5`
- `Kimi K2`
- `MiniMax M1`

For architecture-diversity sidecars:

- `Mercury 2`

## 6. Evidence Policy

### Baseline Views

- `paper_original` where paper materials exist
- otherwise `source_text`

### Headline Semantic Alternate

- `l2_neutralized`

### Non-Headline

- `l3_abstracted`

## 7. Primary Endpoints

- `abstain_rate`
- `scale_occupancy`
- `singleton_rate`
- `mean_subset_size`
- `expected_stage`
- `stage_entropy`

## 8. Why This Is Stronger Than The Earlier Draft

The earlier draft had the right target bundle and provider panel, but it underused the strongest transferable V3 result. This revised spec fixes that by making abstention a full provider-panel intervention instead of an OpenAI-only mechanism check, while still keeping the rest of the matrix bounded and faithful to the literature-audit framing.
