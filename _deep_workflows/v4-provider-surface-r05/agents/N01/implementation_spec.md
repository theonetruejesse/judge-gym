# Revised Implementation-Facing Study Spec

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
  - `qwen_current_text_flagship`

### Zheng

- `baseline_faithful`
- `abstention_on`
- provider replications for:
  - `gpt-4.1`
  - `gpt-5.2`
  - `claude-sonnet-4`
  - `qwen_current_text_flagship`

## 3. OpenRouter Freeze Rule

At experiment instantiation time:

- resolve `qwen_current_text_flagship` to the latest stable text-only, non-thinking Qwen open-weight model present on OpenRouter
- avoid multimodal / VL Qwen variants for the headline matrix
- if the latest Qwen line is unstable or poorly documented at freeze time, use `qwen/qwen3-next-80b-a3b-instruct`

## 4. Appendix / Robustness Experiments

- `gpt-4.1-mini`
- `gpt-5.2-chat`
- `Ziems` subset after subset lock
- optional `l2` comparator view for Zheng if prompt fidelity survives

Provider-family appendix/watchlist:

- `deepseek/deepseek-v3.2`
- `z-ai/glm-4.5`
- `moonshotai/kimi-k2`
- `minimax/minimax-m1`

Architecture-diversity sidecar:

- `inception/mercury-2`

## 5. Runtime Preconditions

The current engine already supports the revised headline matrix:

- evidence universes and sets
- source records versus semantic views
- semantic transform runs
- OpenAI, Anthropic, and OpenRouter routing

No new platform-generalization work is required to lock this revised matrix.

## 6. Explicit Deferred Work

- broad many-model OpenRouter sweeps
- Gemini / Grok provider lanes
- Ziems appendix lane
- Santurkar expansion lane
- Mercury 2 sidecar unless the main paper is already stable
