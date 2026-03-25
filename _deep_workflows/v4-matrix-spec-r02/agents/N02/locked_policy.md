# Locked V4 Matrix Policy

## Headline Paper Bundle

The wave-1 headline paper bundle is:

1. `Gilardi`
2. `Zheng / MT-Bench`

`Ziems` moves to an appendix or immediate follow-on lane rather than the headline matrix.

## Provider Policy

### Headline Models

- OpenAI:
  - `gpt-4.1`
  - `gpt-5.2`
- Anthropic:
  - `claude-sonnet-4`
- OpenRouter:
  - `claude-sonnet-4-openrouter`

### Secondary OpenAI Controls

- `gpt-4.1-mini`
- `gpt-5.2-chat`

These belong in robustness or appendix panels, not every headline cell.

### OpenRouter Breadth Decision

Wave-1 V4 makes a **provider-surface** claim, not a broad “OpenRouter family diversity” claim. Broader OpenRouter model coverage becomes an implementation extension after the matrix is already locked.

## Evidence View Policy

### Headline Baseline

- `paper_original` for imported paper-audit targets where available
- otherwise `source_text`

### Headline Alternate

- `l2_neutralized`

### Excluded From Headline

- `l3_abstracted`

## Target-Specific Extension Table

### Gilardi

Headline conditions:

- faithful baseline
- abstention perturbation
- raw vs `l2_neutralized`
- provider-family replication

Appendix-only if defensible:

- label-space expansion
- grouping, only if the imported evidence can be grouped without violating paper fidelity

### Zheng

Headline conditions:

- faithful baseline
- abstention perturbation
- provider-family replication

Appendix-only if prompt fidelity survives:

- raw vs `l2_neutralized`
- scale expansion

## Final Matrix Principle

V4 is now locked as:

- a smaller, stronger headline matrix
- plus appendix lanes for within-OpenAI controls and non-headline target breadth
