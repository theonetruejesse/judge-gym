# Candidate V4 Matrix

## Paper Shape

V4 should be a self-contained method-and-case-study paper built around three targets:

1. `Gilardi` as the primary coder-replacement audit
2. `Ziems` as a scoped subset audit
3. `Zheng / MT-Bench` as the default comparator lane

The paper should use a **shared protocol skeleton** across targets, then allow **conditional extensions** only where the task actually supports them.

## Shared Protocol Skeleton

Every target gets:

### A. Faithful Baseline

- use the paper-faithful evidence surface
- use the paper-faithful task framing
- use the paper-faithful label/rubric contract
- treat this as the reconstruction anchor

### B. Core Perturbations

These should be the universal V4 perturbation families:

1. `abstention policy`
   - baseline paper-faithful handling
   - explicit abstain-enabled variant

2. `provider family`
   - OpenAI headline family
   - Anthropic control
   - OpenRouter control

3. `evidence view`
   - raw / paper-original baseline
   - one semantic alternate view, defaulting to `l2_neutralized`

## Conditional Extensions

Use only where the target supports them cleanly:

1. `grouping / bundle policy`
   - only for evidence sets where multiple items can be grouped meaningfully

2. `scale or label-space expansion`
   - only where the original task has ordinal structure or a defensible expanded label contract

3. `model placement`
   - only for tasks that actually contain multiple LLM roles or a meaningful rubric-vs-scoring split

## Evidence Policy

### Raw Baseline Rule

For all paper-audit targets, the baseline headline condition must use the original imported text surface:

- `paper_original` where available
- otherwise `source_text`

### Semantic Alternate Rule

The default semantic alternate should be:

- `l2_neutralized`

`l3_abstracted` stays out of the headline matrix because the pilot evidence did not support it as a first-order lever.

## Provider Policy

### Headline OpenAI Family

- `gpt-4.1`
- `gpt-5.2`

### OpenAI Secondary Controls

- `gpt-4.1-mini`
- `gpt-5.2-chat`

These belong in a selective within-family appendix or robustness slice, not every headline matrix cell.

### Wave-1 Non-OpenAI Controls

- `claude-sonnet-4`
- `claude-sonnet-4-openrouter`

This is sufficient for a **provider-surface** wave-1 claim, but not yet for a “broad OpenRouter model-family” claim.

## Primary Endpoints

- `abstain_rate`
- `scale_occupancy`
- `singleton_rate`
- `mean_subset_size`
- `expected_stage`
- `stage_entropy`

Secondary diagnostics:

- aggregation summaries
- rubric-stage similarity
- grouping sensitivity

## Remaining Gaps After R01

1. exact `Ziems` subset lock
2. whether wave-1 must include more than one OpenRouter-backed model
3. target-by-target conditional extension table

R01 therefore yields a strong candidate matrix shape, but not yet terminal closure.
