# V4 Specs

## Study Goal

V4 is a self-contained evaluator-regime audit paper. It uses literature-audit targets to show that evaluator behavior depends on the configured regime, while carrying forward only the V3 levers that remain meaningful under paper-faithful conditions.

Headline targets:

1. `Gilardi`
2. `Zheng / MT-Bench`

`Ziems` remains appendix or immediate follow-on, not part of the headline paper.

## Provider Panel

### Headline Providers

- `gpt-4.1`
- `gpt-5.2`
- `claude-sonnet-4`
- `qwen_current_text_flagship`

### OpenRouter Rule

`qwen_current_text_flagship` means:

- freeze to the latest stable text-only, non-thinking Qwen open-weight model available on OpenRouter at experiment freeze time
- avoid multimodal / VL Qwen variants in the headline matrix
- fallback: `qwen/qwen3-next-80b-a3b-instruct`

### Appendix / Watchlist Providers

- `gpt-4.1-mini`
- `gpt-5.2-chat`
- `deepseek/deepseek-v3.2`
- `z-ai/glm-4.5`
- `moonshotai/kimi-k2`
- `minimax/minimax-m1`
- `inception/mercury-2`

## V3 Transfer Policy

V4 does not replay the full V3 matrix. It carries forward the V3 levers that are both scientifically strong and portable to literature-audit settings.

### Headline-Carried V3 Families

- `d1` control -> `baseline_faithful`
- `a1` abstention toggle -> `abstention_on`
- raw versus `l2_neutralized` evidence surface where fidelity survives

### Appendix-Carried V3 Families

- `a3`, `c6`, `c7` -> scale expansion
- `b1`, `c4`, `c5` -> small/chat follow-ups

### Explicitly Not Carried Into The Headline

- `a4` rubric/scoring role swap
- `a5` concept framing
- `c1`, `c2` bundle strategy
- `a2`, `c3`, and `l3` as a headline emphasis

This transfer rule is grounded in [v3_gpt_ablations.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md) and the campaign artifact [v3_transfer_policy.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-v3-transfer-r06/agents/N01/v3_transfer_policy.md).

## Why These V3 Decisions Carry

### Abstention Carries Hard

V3 found abstention to be the strongest and cleanest replicated intervention. It changes the operating regime, not just the format of the answer. Because it is portable across target types and provider families, it becomes a full provider-panel intervention in V4 rather than an OpenAI-only mechanism check.

### Raw Versus `l2_neutralized` Carries Selectively

V4 still needs one evidence-surface perturbation to preserve continuity with `judge-gym` as a measurement framework. `l2_neutralized` is the strongest defensible semantic transform for literature audits. It is safest on `Gilardi`, where the paper-audit setup can tolerate a controlled semantic rewrite more naturally than `Zheng`.

### Scale Carries Only As Appendix

V3 showed scale expansion changes expression more than certainty. That makes it worth keeping, but not as one of the main wave-1 paper claims. It is most plausible as a `Zheng` appendix extension if the comparator output contract remains faithful.

### Small/Chat Carries Only As Appendix

V3 showed smaller/chat models are distinct regimes, not just weaker copies. That matters for OpenAI internal robustness, but it does not need to enter every headline cell.

### Concept Framing, Placement, and Bundles Do Not Carry

These are important V3 findings, but they do not transfer cleanly into the headline literature-audit paper:

- concept framing would violate paper-fidelity for `Gilardi` and `Zheng`
- rubric/scoring role swap depends on a decomposed pipeline that is not the main wave-1 literature-audit story
- bundle strategy matters most for native multi-evidence `judge-gym` studies, not for mostly single-item imported audit targets

## Headline Matrix

| Target | Condition | Evidence View | Providers | Count |
| --- | --- | --- | --- | ---: |
| `Gilardi` | `baseline_faithful` | `paper_original` if available, else `source_text` | all headline providers | 4 |
| `Gilardi` | `abstention_on` | same as baseline | all headline providers | 4 |
| `Gilardi` | `view_l2_neutralized` | `l2_neutralized` | all headline providers | 4 |
| `Zheng / MT-Bench` | `baseline_faithful` | `source_text` | all headline providers | 4 |
| `Zheng / MT-Bench` | `abstention_on` | same as baseline | all headline providers | 4 |

Headline total: **20 experiments**

## Appendix Matrix

### OpenAI Internal Robustness

Providers:

- `gpt-4.1-mini`
- `gpt-5.2-chat`

Conditions:

- faithful baseline
- abstention on

### Conditional Target Extensions

For `Zheng`:

- `view_l2_neutralized` if prompt fidelity survives
- scale expansion if the output contract remains defensible

### Provider-Family Follow-On

Appendix / watchlist lanes:

- `deepseek/deepseek-v3.2`
- `z-ai/glm-4.5`
- `moonshotai/kimi-k2`
- `minimax/minimax-m1`

Architecture-diversity sidecar:

- `inception/mercury-2`

## Evidence Policy

### Baseline Views

- `paper_original` where released paper materials exist
- otherwise `source_text`

### Headline Semantic Alternate

- `l2_neutralized`

### Non-Headline

- `l3_abstracted`

## Primary Endpoints

Use the geometry-first panel carried forward from V3:

- `abstain_rate`
- `scale_occupancy`
- `singleton_rate`
- `mean_subset_size`
- `expected_stage`
- `stage_entropy`

## Claim Boundary

The paper makes a bounded wave-1 claim:

- evaluator-regime movement survives outside OpenAI
- abstention is the strongest portable intervention across the new family panel
- semantic evidence handling matters, but only within a fidelity-preserving bound

It does **not** claim:

- a full provider census
- a full replay of the V3 design space
- that concept framing, placement, and bundle strategy have been exhausted in cross-family form

## Canonical Campaign Artifacts

- [final_matrix_memo.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-provider-surface-r05/agents/N01/final_matrix_memo.md)
- [implementation_spec.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-provider-surface-r05/agents/N01/implementation_spec.md)
- [v3_transfer_policy.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-v3-transfer-r06/agents/N01/v3_transfer_policy.md)
- [revised_v4_spec.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-v3-transfer-r06/agents/N02/revised_v4_spec.md)
