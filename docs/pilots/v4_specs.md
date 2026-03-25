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

## Implementation Logistics

### Do Not Swap Inputs Naively

V4 should not port a target paper by simply pasting its rubric and evidence into an experiment row.

The correct process is:

1. import the target's released task units into a V4 `evidence_universe`
2. curate a frozen `evidence_set`
3. pin each item to `paper_original` or `source_text`
4. register a paper-audit package that freezes:
   - prompt template
   - instructions
   - rubric or codebook
   - label space
   - output contract
   - provenance and freeze metadata
5. instantiate a `paper_faithful` experiment against that package
6. run a target-specific canary before expanding to the full matrix

### What The Current Engine Already Supports

- direct evidence import into `paper_audit` universes
- curated `evidence_sets`
- raw source records decoupled from semantic views
- semantic transform runs for `l1`, `l2`, and `l3`
- evidence-set-backed experiment creation
- `paper_faithful`, `paper_translated`, and `stress_test` compatibility modes
- task contracts with prompt-template, instruction, and label-space fields
- output contracts for verdict-line, label, and structured-json parsing
- generic V4 substrate smoke via `bun run v4:smoke`

### What We Still Need Before Target-Specific Canaries

Required before `Gilardi` and `Zheng` canaries:

1. a first-class `paper_audit_packages` registry
2. target import adapters or scripts for `Gilardi` and `Zheng`
3. target-specific prompt or rubric package storage
4. target-specific canary scripts
5. OpenRouter/Qwen support in the smoke harness

Not required before the headline paper run:

1. `Ziems` import
2. semantic clustering over evidence-set bundles
3. broader appendix/watchlist provider execution

### Smoke And Canary Ladder

1. substrate smoke:
   - existing `bun run v4:smoke`
2. provider smoke:
   - extend smoke to include the Qwen OpenRouter lane
3. paper target canary:
   - `gilardi_canary`
   - `zheng_canary`
4. condition canary:
   - abstention-on
   - `l2_neutralized` where applicable
5. matrix execution

### Bundle Policy

Bundle checks are not part of the headline paper-fidelity lanes.

- `Gilardi`: no headline bundles
- `Zheng / MT-Bench`: no headline bundles
- `Ziems`: best appendix or follow-on literature-audit candidate for bundle checks
- native `judge-gym` evidence studies: full bundle-sensitive regime analysis

This preserves the V3 lesson that grouping is part of the instrument without forcing bundled tasks into paper-faithful targets that are fundamentally single-item or benchmark-native.

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
