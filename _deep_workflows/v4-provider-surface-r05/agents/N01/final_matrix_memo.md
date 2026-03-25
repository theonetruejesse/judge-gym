# Final Revised V4 Matrix Memo

## Final Headline Paper Shape

V4 remains a self-contained evaluator-regime audit paper with a **two-target headline matrix**:

1. `Gilardi` as the primary coder-replacement audit
2. `Zheng / MT-Bench` as the general comparator outside social-science coding

`Ziems` remains an appendix or immediate follow-on lane rather than the headline bundle.

## Revised Headline Provider Panel

### Primary OpenAI Family

- `gpt-4.1`
- `gpt-5.2`

### Wave-1 Controls

- `claude-sonnet-4`
- `qwen_current_text_flagship` via OpenRouter

### Secondary OpenAI Appendix Controls

- `gpt-4.1-mini`
- `gpt-5.2-chat`

## OpenRouter Policy

The OpenRouter headline lane is no longer a routed Anthropic placeholder.

It is now a **Qwen-centered Chinese open-weight control lane**:

- freeze to the latest stable text-only, non-thinking Qwen open-weight model available on OpenRouter when the matrix is instantiated
- avoid VL / multimodal Qwen variants in the headline matrix
- if the frontier Qwen text line is unstable at freeze time, fall back to `qwen/qwen3-next-80b-a3b-instruct`

## Final Headline Matrix

### Gilardi

Headline cells:

- faithful baseline
- abstention perturbation
- raw vs `l2_neutralized`
- provider-family replication over the headline provider panel

### Zheng

Headline cells:

- faithful baseline
- abstention perturbation
- provider-family replication over the headline provider panel

Appendix-only:

- raw vs `l2_neutralized` if comparator prompt fidelity survives condensation
- scale expansion if the output contract stays faithful

## Evidence Policy

### Headline Baseline Views

- `paper_original` when importing released paper materials
- `source_text` when `paper_original` does not exist

### Headline Alternate View

- `l2_neutralized`

### Explicit Non-Headline View

- `l3_abstracted`

## Primary Endpoints

- `abstain_rate`
- `scale_occupancy`
- `singleton_rate`
- `mean_subset_size`
- `expected_stage`
- `stage_entropy`

## Appendix / Watchlist Provider Surface

These are explicitly **not** headline cells, but they are now part of the V4 follow-on plan:

- `deepseek/deepseek-v3.2`
- `z-ai/glm-4.5`
- `moonshotai/kimi-k2`
- `minimax/minimax-m1`
- `inception/mercury-2`

Interpretation:

- `DeepSeek V3.2` and `GLM 4.5` are the strongest appendix-grade follow-ons.
- `Kimi K2` and `MiniMax M1` are watchlist candidates for broader provider-family mapping.
- `Mercury 2` is a dedicated architecture-diversity sidecar, not part of the headline paper claim.

## Claim Boundary

The paper still makes a **bounded provider-family** wave-1 claim, not a broad census claim. The revision strengthens the non-OpenAI comparison by making the OpenRouter lane substantively different, while still keeping the main matrix small enough to execute.
