# Launch Bundle And Provider Policy

## Launch Bundle

### Primary Target

- `Gilardi`
- Role: the most legible case against the idea that LLM coders are neutral drop-in replacements

### Secondary Target

- `Ziems` as a precommitted subset only
- Role: show that the audit protocol generalizes beyond one paper without pretending to audit an entire heterogeneous program

### Comparator Default

- `Zheng / MT-Bench`
- Role: show the same regime-audit logic outside social-science coding

### Deferred Or Alternate Targets

- `Thakur` remains the clean alternate comparator
- `Santurkar` remains a later-wave expansion target
- `Törnberg` remains conditional

## Provider Panel Policy

### OpenAI Primary Family

Use OpenAI as the continuity and headline family:

- `gpt-4.1`
- `gpt-5.2`

Treat these as the primary cross-target headline models.

### OpenAI Secondary Within-Family Controls

Use these as selective within-family robustness checks rather than universal headline cells:

- `gpt-4.1-mini`
- `gpt-5.2-chat`

### Anthropic Control

Use:

- `claude-sonnet-4`

This is the wave-1 non-OpenAI frontier-family control.

### OpenRouter Control

Current live runtime support only guarantees:

- `claude-sonnet-4-openrouter`

So the defensible wave-1 paper claim is **provider-surface control**, not yet broad model-family diversity inside OpenRouter.

## Matrix-Blocking Decisions Still Open After This Node

1. the exact `Ziems` subset rule
2. whether the paper treats OpenRouter as one provider-surface control or as a broader multi-model slice in wave 1
3. exact raw-versus-semantic view usage rules per target class
4. exact conditional use of grouping and model-placement perturbations by target
