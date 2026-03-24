# Final Report: V4 Paper Target Viability

## Objective

Determine which candidate published papers are actually viable targets for judge-gym V4 audits, based on current conversation context, thread export clues, and source-backed checks of dataset/prompt/protocol reproducibility and engine fit.

## Workflow Summary

- Objective class: `research_audit_triage`
- Operating mode: operationally read-only; metadata uses `live_ops` only because the current validator requires that mode for web-backed nodes.
- Execution mode: `compile_and_execute`

## Findings

- The thread export does not support a broad literature sweep. It supports a narrow shortlist built around fairness of reconstruction and external legibility.
- `Gilardi et al.` is the strongest immediate V4 target because it fits the project's evaluator-regime thesis, appears reconstructable, and maps directly onto coder-replacement auditing.
- `Ziems et al.` is the best broad social-science family, but should be targeted through a scoped subset rather than a whole-program replication.
- `Santurkar et al.` is highly reconstructable, but it should be treated as a deliberate engine-expansion target rather than a low-lift third audit.
- `Törnberg` is strategically attractive but should remain conditional until data/materials and prompt recoverability are confirmed.
- `Zheng / MT-Bench` and `Thakur et al.` are the cleanest comparator options if V4 wants one mainstream benchmark-style case to show the regime-audit thesis generalizes beyond contested political or social-science coding.
- `Stureborg`, `Wei`, `Shi`, and much of the methods literature are better treated as framing, support, or narrow comparators than as the empirical center of V4.

## Decisions

- Recommended primary launch targets:
  - `Gilardi et al.`
  - `Ziems et al.` at subset scope
- Recommended third slot:
  - `Zheng / MT-Bench` if V4 wants the canonical benchmark comparator
  - `Thakur et al.` if V4 wants a strong public-materials comparator in a more controlled setup
- Optional expansion slot:
  - `Santurkar et al.` if V4 explicitly wants to broaden the engine to survey/opinion auditing
- Conditional target:
  - `Törnberg`, only after a dedicated materials-feasibility check
- Support / framing only:
  - `Stureborg et al.`
  - `Wei et al.`
  - `Shi et al.` unless V4 explicitly wants a position-bias comparator

## Engine Implications

These targets imply a concrete V4 generalization path:

- `EvidenceUniverse` must support articles, social posts, survey items, benchmark examples, and model outputs.
- `AdjudicativeRubric` must support class-coded labeling, ordinal scales, abstention policies, and pairwise or comparative prompts where needed.
- `ScoringRegime` must support baseline-faithfulness modes, rubric/scoring model placement, prompt-template variants, grouping policy, and aggregation changes.
- V4 should separate "faithful reconstruction of original pipeline" from "judge-gym perturbation sweep" as distinct stages.

## Validation

- Workflow structure validated successfully with `validate_workflow.py`.
- Lead synthesis completed from local export analysis plus source-backed paper checks.
- Remaining limitation: this pass classifies viability from public surfaces and thread context; it does not yet pull each target's full artifact bundle into the repo.
