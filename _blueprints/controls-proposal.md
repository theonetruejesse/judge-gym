# Controls Proposal: LLM-as-Judge Biases

This proposal turns the critic into a first-class measurement instrument and adds lightweight bias checks without changing the overall experimental intent.

## Goals

- Separate judgment from critique (reduce self-evaluation and anchoring bias).
- Quantify critic variance and prompt sensitivity.
- Bound content-specific bias via paired evidence transformations.
- Keep analysis compatible with existing TBM/DST workflow.

## Summary of Gaps

Current pipeline uses a single critic prompt with the same model that produced the verdict, and treats `expertAgreementProb` as a point estimate. This leaves:

- Self-evaluation overconfidence (Kadavath-style risk).
- Prompt sensitivity / anchoring effects in critics (Stureborg-style risk).
- No explicit critic variance measurement.
- Content-specific bias only indirectly controlled via evidence views.

## Proposed Controls (Minimal, Composable)

### 1) Critic as an Axis (Pipeline)

Add config axes to allow independent critic behavior:

- `critic_model`: model used for score critic (can differ from scorer).
- `critic_variants`: multiple prompt phrasings (IDs) per critic.
- `critic_repeats`: same prompt repeated to estimate variance.
- `critic_blind`: whether critic sees the model verdict.

Implementation points:

- `packages/engine/convex/schema.ts`: add config fields.
- `packages/engine/convex/workflows/stage_enqueue.ts`: enqueue multiple critics per score by variant/repeat/model; allow blind mode.
- `packages/engine/convex/prompts/scoring_prompts.ts`: add alternate critic prompt templates and blind prompt.
- `packages/engine/convex/models/experiments.ts`: store critic metadata (variant, repeat, blind, critic model).

### 2) Critic Variance in Analysis

Treat `expertAgreementProb` as a distribution:

- Aggregate critic responses per score: mean, std, quantiles.
- Penalize high variance: e.g., `p_score_adj = mean_p * exp(-lambda * std_p)`.
- Compare blind vs full critic to estimate anchoring bias; record delta as a penalty or report.

Implementation point:

- `packages/analysis/notebooks/example.py`: add a small aggregation step before TBM/DST mass assignment.

### 3) Content-Specific Bias Bounds

Use paired evidence transformations:

- `evidence_view` already supports `raw`, `cleaned`, `neutralized`, `abstracted`.
- Run paired experiments with identical configs except evidence view.
- Measure verdict shift as a bias diagnostic.

Add two lightweight controls:

- **Counterfactual swaps**: flip named actors/identifiers in a subset; measure delta.
- **Label neutralization**: wire `label_neutralization_mode` into `ExperimentConfig` and compare `none` vs `generic`.

### 4) Optional: Cross-Model Critic Baselines

- For each scoring model, run a “foreign critic” model.
- Use inter-critic agreement to detect model-specific familiarity bias.

## Analysis Integration (Minimal Changes)

- Build a critic-aggregate table keyed by `scoreId`.
- Replace `expertAgreementProb` with `p_score_adj` in TBM/DST.
- Track and report critic variance + anchor deltas in summary tables.

## Deliverables Checklist

- [ ] Config axes added: `critic_model`, `critic_variants`, `critic_repeats`, `critic_blind`, `label_neutralization_mode`.
- [ ] Score critic requests include metadata + possible multiple calls.
- [ ] Analysis uses critic variance-adjusted `p_score`.
- [ ] Evidence view paired experiments run for bias bounding.

## Suggested Defaults (Pilot)

- `critic_model`: same model + one cross-model critic.
- `critic_variants`: 2 prompt templates.
- `critic_repeats`: 2 (same prompt).
- `critic_blind`: `true` for at least one critic.
- `label_neutralization_mode`: `none` vs `generic`.

This keeps changes small, but yields a defensible bias-control story for LLM-as-judge experiments.
