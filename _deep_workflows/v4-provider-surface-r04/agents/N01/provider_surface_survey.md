# Provider Surface Survey

## Why The Prior Lock Needed Reopening

The prior `claude-sonnet-4-openrouter` lane was a provider-surface placeholder, not the family contrast actually desired for V4. It gave route-level diversity, but not the Chinese open-weight comparison lane that the current paper should use to test whether evaluator geometry survives outside OpenAI under a materially different training and release ecosystem.

## Selection Criteria

For the OpenRouter lane and adjacent watchlist, the relevant criteria are:

1. text-first fidelity for paper-audit tasks
2. open-weight or meaningfully open release posture
3. current OpenRouter reachability
4. regime-relevant architectural or post-training differences
5. bounded enough to keep the headline matrix small

## Headline Recommendation

### Replace the OpenRouter placeholder with a Qwen lane

The best revised headline OpenRouter lane is **Qwen**, not Claude routed through OpenRouter.

Reason:

- It satisfies the intended Chinese open-weight comparison better than the old placeholder.
- The live registry now shows a current Qwen family surface with multiple text candidates.
- Qwen offers text-first non-thinking variants, which fit faithful paper audits better than visible-thinking defaults.
- Qwen keeps the OpenRouter lane legible: one non-OpenAI, non-Anthropic, open-weight family with broad multilingual and long-context capability.

### Concrete instantiation rule

Lock the OpenRouter headline lane as:

- `qwen_current_text_flagship`

Implementation freeze rule:

- choose the latest stable **text-only**, non-thinking Qwen open-weight model available on OpenRouter at experiment freeze time
- avoid VL / multimodal Qwen variants for the headline matrix
- if the frontier Qwen text line is unstable at freeze time, fall back to `qwen/qwen3-next-80b-a3b-instruct`

This keeps the policy aligned with the user intent while avoiding a brittle hard-code to a moving frontier identifier.

## Shortlist Beyond Qwen

### 1. DeepSeek V3.2

Best appendix/follow-on candidate if we want one additional Chinese open-weight family with a different process signature.

Why it matters:

- sparse-attention path rather than a plain “same family, different size” story
- agentic task synthesis and RL-heavy post-training
- explicit reasoning control surface

Disposition:

- **appendix lane or immediate follow-on**

### 2. Z.ai GLM 4.5

Strong appendix candidate because it is explicitly agent-oriented and exposes both thinking and non-thinking modes.

Why it matters:

- MoE with hybrid inference modes
- strong agent/tool-use positioning
- useful for testing whether mode-switchable reasoning surfaces alter adjudicative geometry

Disposition:

- **appendix lane**

### 3. Moonshot Kimi K2

Strong candidate for future diversity panels, especially if we want a model with a distinct optimizer/training-stack story.

Why it matters:

- 1T-parameter MoE with 32B active
- strong tool-use / coding / reasoning orientation
- distinct MuonClip optimizer story

Disposition:

- **watchlist / follow-on**

### 4. MiniMax M1

Interesting because it is a true process/architecture contrast, but too divergent for the headline OpenRouter lane.

Why it matters:

- hybrid MoE plus custom lightning attention
- million-token context
- custom RL pipeline

Disposition:

- **architecture-diversity appendix or follow-on**

### 5. Mercury 2

This is the cleanest “diffusion LLM” outlier on the live surface, but it should not be mixed into the headline matrix.

Why it matters:

- genuine diffusion-style text generation
- strongly different latency/decoding process

Why it stays out of the headline:

- it changes too many things at once for the main paper claim
- it is not part of the Chinese open-weight comparison objective

Disposition:

- **exploratory sidecar only**

## Net Recommendation

Revise the V4 policy as follows:

1. OpenAI remains primary.
2. Anthropic remains the direct commercial control.
3. OpenRouter becomes a **Qwen open-weight control lane**, not a routed Anthropic mirror.
4. Additional Chinese open-weight families move into an explicit appendix/watchlist instead of bloating the headline matrix.
