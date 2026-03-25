# Final V4 Matrix Memo

## Final Headline Paper Shape

V4 is a self-contained evaluator-regime audit paper with a **two-target headline matrix**:

1. `Gilardi` as the primary coder-replacement audit
2. `Zheng / MT-Bench` as the general comparator outside social-science coding

`Ziems` moves to an appendix or immediate follow-on lane rather than the headline bundle.

## Headline Provider Panel

### Primary OpenAI Family

- `gpt-4.1`
- `gpt-5.2`

### Wave-1 Controls

- `claude-sonnet-4`
- `claude-sonnet-4-openrouter`

### Secondary OpenAI Appendix Controls

- `gpt-4.1-mini`
- `gpt-5.2-chat`

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

## Claim Boundary

The paper makes a **provider-surface** wave-1 claim, not a broad “many OpenRouter models” claim. It argues that evaluator-regime movement survives outside OpenAI under a bounded control panel, not that every provider family has already been exhaustively mapped.
