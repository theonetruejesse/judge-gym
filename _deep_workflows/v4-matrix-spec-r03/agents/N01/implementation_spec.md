# Implementation-Facing Study Spec

## 1. Evidence Imports

### Gilardi

- import released paper items into one `evidence_universe`
- store original task text as `paper_original`
- freeze a curated `evidence_set`
- generate `l2_neutralized` views for the same set

### Zheng

- import benchmark prompts / judged outputs into one `evidence_universe`
- store the original judge-facing text as `source_text`
- freeze a curated `evidence_set`
- only generate `l2_neutralized` if a fidelity check passes

### Ziems

- do not block the headline paper on this import
- treat as appendix or immediate follow-on after a subset rule is written

## 2. Experiment Families

### Gilardi

- `baseline_faithful`
- `abstention_on`
- `view_l2_neutralized`
- provider replications for:
  - `gpt-4.1`
  - `gpt-5.2`
  - `claude-sonnet-4`
  - `claude-sonnet-4-openrouter`

### Zheng

- `baseline_faithful`
- `abstention_on`
- provider replications for:
  - `gpt-4.1`
  - `gpt-5.2`
  - `claude-sonnet-4`
  - `claude-sonnet-4-openrouter`

## 3. Appendix / Robustness Experiments

- `gpt-4.1-mini`
- `gpt-5.2-chat`
- `Ziems` subset after subset lock
- optional `l2` comparator view for Zheng if prompt fidelity survives

## 4. Runtime Preconditions

The current engine already supports the core headline matrix:

- evidence universes and sets
- source records versus semantic views
- semantic transform runs
- OpenAI, Anthropic, and OpenRouter routing

No new platform-generalization work is required to lock the matrix itself.

## 5. Explicit Deferred Work

- broad OpenRouter model-family expansion
- Gemini / Grok provider lanes
- Ziems appendix lane
- Santurkar expansion lane
