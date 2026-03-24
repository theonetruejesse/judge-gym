# Experiment And Prompt Surface Plan

## Recommendation

Generalize the experiment surface, but do not build a full generic `StagePlan` runner in wave 1.

Wave 1 should separate these concerns in config:

- evidence source and rendered view
- adjudication task
- rubric source
- scoring regime
- execution profile
- reporting and reproducibility

## Wave-1 Config Additions

1. `evidence_ref`
   - points to the imported audit set or existing news evidence
   - selects the rendered view used at scoring time

2. `adjudication_task`
   - wave-1 allowed values:
     - `categorical_single`
     - `categorical_multi`
     - `ordinal_stages`

3. `rubric_source`
   - `generated`
   - `imported`
   - `frozen`
   - `none`

4. `scoring_output_contract`
   - strict parse target for wave 1
   - keep it simple and machine-checkable

5. `compatibility_mode`
   - flags that a run is trying to stay faithful to a paper’s prompt or codebook

## Keep In The Existing Runner

- current fixed stage lifecycle
- current run orchestration and counters
- current rubric-first flow for contested-concept work

## Smallest Bridge For Paper Audits

- allow imported or frozen codebooks/rubrics
- allow scoring prompts that are not concept-generation prompts
- record exact rendered evidence view and exact output parser used
- keep perturbation logic in experiment config, not in bespoke scripts

## Explicit Deferrals

- generic stage registry
- pairwise comparator tasks
- prompt replay machinery that requires multi-turn or complex parser contracts
- analysis-wide migration to non-ordinal output spaces
