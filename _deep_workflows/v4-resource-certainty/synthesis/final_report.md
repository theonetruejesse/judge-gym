# Final Report: V4 Resource Certainty

## Objective

Run a deep-search-style certainty-scored research pass, using a deep-workflow artifact, to determine whether shortlisted V4 candidate-paper resources are reconstructable enough for fair judge-gym audits and which targets are best supported by current public materials.

## Workflow Summary

- Objective class: `research_audit_triage`
- Operating mode: operationally read-only; metadata uses `live_ops` only because the validator requires that mode for web-backed nodes.
- Execution mode: `compile_and_execute`

## Findings

- `Gilardi` is the strongest immediate primary target with a certainty score of `0.86`.
- `Ziems` remains a primary target only under explicit subset scope, at `0.74`.
- `Zheng / MT-Bench` is the cleanest comparator at `0.91`.
- `Thakur` is a strong alternate comparator at `0.81`.
- `Santurkar` is a real resource candidate, but best treated as an expansion-wave target at `0.82`.
- `Törnberg` is materially viable but still conditional at `0.68`.

## Decisions

- Recommended launch bundle:
  - `Gilardi`
  - scoped `Ziems`
  - `Zheng` by default as comparator
- Strong alternate comparator:
  - `Thakur`
- Reserved expansion-wave target:
  - `Santurkar`
- Conditional but still viable:
  - `Törnberg`
- Support only:
  - `Wei`
  - `Shi`
  - `Stureborg`

## Why The Scores Stop Short Of Full Confidence

- the top replication bundles have not yet been directly inspected;
- legacy API/model drift affects several baselines;
- `Ziems` requires a precommitted subset rule to avoid fairness objections;
- `Santurkar` is blocked by engine-lift cost, not by lack of resources.

## Validation

- Workflow structure validated successfully with `validate_workflow.py`.
- The workflow produced area-specific evidence, micro-hypotheses, null challenges, and a separate certainty-scoring pass.
- The paired blueprint was updated at `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-target-resource-viability/blueprint.md`.
