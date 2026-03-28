# V4 Native OpenAI Scale

## Goal

This is the first full-volume native V4 promotion pass after the GPT-4.1 screen.

It scales only the native conceptual lanes that showed clear movement in the first GPT-4.1 slice, then runs them across the OpenAI family before spending budget on non-OpenAI providers.

## Promoted Native Lanes

Promoted from [v4_native_gpt41.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v4_native_gpt41.md):

- `fascism_baseline_source`
- `fascism_abstention_source`
- `fascism_view_l2_neutralized`
- `illiberal_democracy_baseline_source`
- `illiberal_democracy_view_l2_neutralized`

Explicitly deferred for now:

- `illiberal_democracy_abstention_source`

The reason is straightforward: it moved less than the corresponding `fascism` abstention lane in the GPT-4.1 screen, so it is lower priority under budget constraints.

## Provider Panel

OpenAI-only promotion panel:

- `gpt-4.1`
- `gpt-5.2`
- `gpt-4.1-mini`
- `gpt-5.2-chat`

This keeps the scale-up within one provider family before we spend on Anthropic or OpenRouter follow-up runs.

## Evidence Contract

All experiments reuse the same frozen native evidence substrate:

- one shared Media Cloud-backed evidence universe
- one curated evidence set
- `48` evidence items
- bundle size `1`
- same item ordering
- same source-record pinning
- existing `l2_neutralized` coverage generated from the current V4 transform pipeline

So the promotion run changes the evaluator regime, not the corpus.

## Full-Volume Scale

This promotion pass uses the serious V3 sample norm:

- `30` matched samples per experiment

That yields:

- `5` lanes
- `4` OpenAI models
- `20` experiments
- `600` matched samples
- `28,800` scored item responses

at `48` evidence items per sample.

## Why This Matrix

This is the smallest OpenAI-only native matrix that still preserves the important native V4 levers:

- concept framing across a shared evidence set
- abstention where it clearly matters
- raw/source versus `l2_neutralized`
- model-family scaling within OpenAI before broader provider spend

## Operational Path

Build the promotion manifests:

```bash
bun run v4:build:native-openai
```

Inspect the launch plan:

```bash
bun run v4:launch:native-openai
```

Run the live full-volume cohort:

```bash
bun run v4:launch:native-openai --live --allow-existing-set
```

The launcher reuses the latest frozen native snapshot set by default and starts `30`-sample runs unless overridden.
