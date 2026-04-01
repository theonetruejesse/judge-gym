# V4 Final

## Status

This document is the current paper-facing state of V4.

As of now, V4 has two completed result lanes:

1. a completed paper-audit headline matrix
2. a completed native OpenAI matrix on a shared Media Cloud-backed evidence set

This is enough to see what the project currently has, before any broader non-OpenAI native expansion.

## Core Claim

V4 is no longer a broad platform story. It is a bounded evaluator-regime paper with two linked surfaces:

- a literature-audit lane that checks whether regime movement survives on recognizable benchmark targets
- a native conceptual lane that checks whether the stronger V3-style regime effects still appear on the new V4 substrate

The high-level outcome is:

- the paper-audit lane is relatively stable and bounded
- the native lane is much more regime-sensitive
- abstention and evidence transforms matter much more in the native conceptual setting than in the paper-audit setting

## Executed Study Lanes

### 1. Paper-Audit Headline Matrix

Targets:

- `Gilardi`
- `Zheng / MT-Bench`

Headline providers:

- `gpt-4.1`
- `gpt-5.2`
- `claude-sonnet-4`
- `qwen_current_text_flagship`

Conditions:

- `Gilardi`
  - `baseline_faithful`
  - `abstention_on`
  - `view_l2_neutralized`
- `Zheng`
  - `baseline_faithful`
  - `abstention_on`

Total:

- `20` headline experiments
- sample size `1` per run
- `Gilardi`: `24` evidence items per run
- `Zheng`: `13` evidence items per run

Supporting artifacts:

- [v4_specs.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v4_specs.md)
- [_deep_workflows/v4-launch-r04/synthesis/analysis_findings.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-launch-r04/synthesis/analysis_findings.md)
- [_deep_workflows/v4-launch-r05/synthesis/rerun_findings.md](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-launch-r05/synthesis/rerun_findings.md)

### 2. Native GPT-4.1 Anchor Slice

Concepts:

- `fascism`
- `illiberal_democracy`

Conditions:

- `baseline_source`
- `abstention_source`
- `view_l2_neutralized`

Total:

- `6` experiments
- sample size `1`
- `48` evidence items per run

Supporting artifact:

- [v4_native_gpt41.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v4_native_gpt41.md)

### 3. Native OpenAI Scale Matrix

Promoted lanes:

- `fascism_baseline_source`
- `fascism_abstention_source`
- `fascism_view_l2_neutralized`
- `illiberal_democracy_baseline_source`
- `illiberal_democracy_view_l2_neutralized`

OpenAI provider panel:

- `gpt-4.1`
- `gpt-4.1-mini`
- `gpt-5.2`
- `gpt-5.2-chat`

Total:

- `20` experiments
- `30` samples per experiment
- `48` evidence items per sample
- `1440` scored item responses per run

Canonical run manifest:

- [v4_native_openai_canonical_runs.json](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v4_native_openai_canonical_runs.json)

Analysis outputs:

- [report.md](/Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v4/native_openai_scale/report.md)
- [summary.json](/Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v4/native_openai_scale/summary.json)
- [v4_native_openai_scale.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v4_native_openai_scale.md)

## Evidence Basis

### Paper-Audit Lane

The literature-audit lane uses imported paper-faithful targets:

- `Gilardi`
- `Zheng / MT-Bench`

These are frozen into V4 evidence sets and run through paper-faithful contracts rather than generic native prompts.

### Native Lane

The native conceptual lane uses one shared Media Cloud-backed evidence universe:

- query: `"fascism" OR "illiberal democracy"`
- collection: U.S. National news
- locale: English
- date window: `2025-09-29` to `2026-03-28`
- retrieved snapshot: `142` items
- curated study set: `48` items

That frozen set is reused across the native GPT-4.1 anchor slice and the native OpenAI scale matrix.

Supporting inventory:

- [v4_data_inventory.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v4_data_inventory.md)

## Main Findings So Far

## Paper-Audit Findings

### Zheng Tie Suppression Is Real

The clearest paper-audit finding is that `Zheng / MT-Bench` shows strong tie suppression across the whole provider panel.

In the first-pass headline matrix:

- `gpt-4.1`: `0` ties
- `gpt-5.2`: `0` ties
- `claude-sonnet-4`: `0` ties
- `qwen`: `0` ties

So even though `Zheng` is a pairwise benchmark where ties are part of the benchmark-native outcome space, the evaluator regimes collapse toward `A` or `B`.

### Gilardi Is More Sensitive To Evidence View Than Zheng

On `Gilardi`, raw versus `l2_neutralized` produces visible provider-dependent movement:

- `gpt-4.1`: `4.2%` label flip rate
- `gpt-5.2`: `4.2%`
- `claude-sonnet-4`: `20.8%`
- `qwen`: `12.5%`

And cross-provider disagreement on `Gilardi` drops from:

- `20.8%` on raw baseline
- to `8.3%` on `l2_neutralized`

So the semantic transform has a smoothing effect in the paper-audit lane, but it is not equally strong across providers.

### Abstention Is Weak In The Paper-Audit Lane

The paper-audit matrix did not show a strong abstention regime.

- `Zheng` had zero ties even with abstention enabled
- `Gilardi` abstention did not materially change the regime in the way it later did on the native evidence set

This is an important negative result. The strong V3 abstention story does not automatically carry into paper-faithful imported tasks.

### GPT-4.1 Stability Check

The focused GPT-4.1 reruns showed:

- `Gilardi baseline`: `0/24` flips
- `Gilardi l2`: `1/24` flips
- `Zheng baseline`: `1/13` flips
- `Zheng abstention`: `0/13` flips

So the paper-audit GPT-4.1 cells are stable enough for interpretation, but the movement is small and bounded.

## Native Findings

### Native Abstention Is Strong Again

In the native conceptual lane, abstention becomes a major regime lever again.

In the initial GPT-4.1 native slice:

- `fascism` baseline -> abstention:
  - abstain delta `+0.167`
  - flip rate `0.771`
- `illiberal_democracy` baseline -> abstention:
  - abstain delta `+0.125`
  - flip rate `0.500`

In the scaled OpenAI matrix, the `fascism baseline -> abstention` contrast remains the dominant within-model effect family:

- `gpt-4.1`: flip `0.729`, abstain delta `0.145`
- `gpt-4.1-mini`: flip `0.703`, abstain delta `0.134`
- `gpt-5.2`: flip `0.640`, abstain delta `0.400`
- `gpt-5.2-chat`: flip `0.731`, abstain delta `0.481`

So the native lane preserves the V3-style abstention story much more strongly than the paper-audit lane.

### Concept Framing Still Changes The Instrument

On the shared evidence set, `fascism` and `illiberal_democracy` are not equivalent framings.

The GPT-4.1 anchor already showed that same-evidence concept changes move the instrument heavily. In the scaled OpenAI matrix, the cross-model results reinforce that this is a real regime surface rather than a one-model accident.

For example:

- `gpt-4.1` baseline `fascism` vs `illiberal_democracy`: flip `0.551`
- `gpt-4.1-mini` baseline `fascism` vs `illiberal_democracy`: flip `0.604`

So concept choice remains one of the main native design-space levers.

### `l2_neutralized` Is A Regime Intervention, Not Neutral Preprocessing

The native matrix does not support the view that semantic cleaning is just harmless denoising.

Examples:

- `gpt-4.1` `fascism source -> l2`: flip `0.599`
- `gpt-4.1` `illiberal_democracy source -> l2`: flip `0.458`
- `gpt-4.1-mini` `fascism source -> l2`: flip `0.560`
- `gpt-4.1-mini` `illiberal_democracy source -> l2`: flip `0.576`

So `l2_neutralized` meaningfully changes the judgment regime. It should be treated as an experimental intervention, not background preprocessing.

### The OpenAI Family Is Not A Single Regime

The scaled native matrix shows large within-family divergence even before leaving OpenAI.

Provider-level means:

- `gpt-4.1`: expected stage `1.604`, abstain rate `0.029`
- `gpt-4.1-mini`: expected stage `1.757`, abstain rate `0.027`
- `gpt-5.2`: expected stage `1.305`, abstain rate `0.080`
- `gpt-5.2-chat`: expected stage `1.416`, abstain rate `0.096`

Strongest cross-model contrasts are concentrated in `fascism abstention` and `fascism l2`:

- `fascism_abstention_source:gpt41mini_vs_gpt41`: flip `0.735`
- `fascism_abstention_source:gpt52_vs_gpt41`: flip `0.696`
- `fascism_abstention_source:gpt52chat_vs_gpt41`: flip `0.694`
- `fascism_view_l2_neutralized:gpt41mini_vs_gpt41`: flip `0.610`

So the OpenAI family itself already contains materially different evaluator regimes.

## Current Interpretation

The V4 picture is coherent:

- paper-faithful imported tasks are comparatively stable and bounded
- native contested-concept evidence produces much larger regime movement
- abstention is not universally strong; it is task- and corpus-dependent
- semantic view changes matter in both lanes, but they matter much more in the native lane
- model-family variation is already substantial inside OpenAI, before looking at Anthropic, Qwen, or Gemini

This is a stronger paper than a generic “models differ” claim. It says the judgment regime depends on:

- task family
- evidence view
- abstention policy
- concept framing
- model family

and those dependencies do not all surface equally in literature-audit and native lanes.

## What We Have Completed

Completed enough to analyze now:

- paper-audit headline matrix: complete
- GPT-4.1 paper-audit rerun check: complete
- native GPT-4.1 anchor slice: complete
- native OpenAI 20-cell full-volume matrix: complete
- canonical analysis baseline for native OpenAI matrix: complete

## What Is Not Yet In This Draft

Not yet part of the current completed paper-facing result set:

- native `claude-sonnet-4` matrix
- native `qwen` matrix
- native `gemini` matrix
- `Ziems`
- bundle-sensitive native follow-ons
- broader appendix/watchlist providers

Those are follow-on lanes, not part of the current completed V4 baseline.

## Recommended Next Step

From here, the cleanest next move is:

1. treat this document as the current V4 baseline writeup
2. choose the few highest-signal native lanes for non-OpenAI promotion
3. run only the providers that matter most under budget:
   - `claude-sonnet-4`
   - `qwen`
   - `gemini`
4. compare them against the completed OpenAI baseline rather than rebuilding the full study narrative from scratch

That keeps V4 cumulative instead of reopening the matrix every time.
