# Final Report: V4 Experiment Matrix Spec

## Terminal Objective

Specify a self-contained V4 paper program and final experiment matrix for judge-gym, grounded in pilots, literature-audit targets, and multi-provider runtime constraints.

## Environment Summary

- `judge-gym` is now a greenfield V4 runtime with Media Cloud-first acquisition, evidence universes and sets, source-record versus semantic-view separation, semantic transform runs, and provider-aware routing for OpenAI, Anthropic, and OpenRouter.
- The strongest scientific continuity sources are `docs/pilots/paper.md` and `docs/pilots/v3_gpt_ablations.md`.
- The strongest prior planning artifacts are `_blueprints/v4-target-resource-viability/blueprint.md` and `_blueprints/v4-refactor-and-study-plan/blueprint.md`.
- The most likely launch-bundle direction remains `Gilardi` primary, scoped `Ziems` secondary, and one comparator lane with `Zheng` as the default choice.

## Progression Strategy

- Preserve the geometry-first pilot thesis as the paper backbone.
- Keep OpenAI as the primary family and add Anthropic and OpenRouter as bounded wave-1 controls.
- Favor matched contrasts over a large full-factorial matrix.
- Prune designs that widen the provider panel, overgeneralize the paper into a platform manifesto, or depend on weakly reconstructable targets.
- Escalate to `deep-workflow` only for bounded spec compilation, not for open-ended ideation.

## Current Best

- `narrow_geometry_first_v4`
- Summary: a self-contained paper with a bounded launch bundle, explicit raw-versus-semantic evidence policy, and a provider panel of OpenAI + Anthropic + OpenRouter.
- Evidence:
  - `docs/pilots/paper.md`
  - `docs/pilots/v3_gpt_ablations.md`
  - `_blueprints/v4-target-resource-viability/blueprint.md`
  - `_deep_workflows/v4-refactor-and-study-planning/agents/N05/study_design_plan.md`

## Next Handoff

- Run `R01`, which asks `deep-workflow` to compile the final V4 matrix-spec package:
  - lock the launch bundle and target roles,
  - lock the provider panel and default model-family policy,
  - lock the evidence-view and transform usage policy,
  - and produce the final matched experiment matrix sheet for the paper.
