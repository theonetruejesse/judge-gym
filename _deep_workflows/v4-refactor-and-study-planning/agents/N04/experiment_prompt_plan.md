# V4 Experiment + Prompt/Config Surface Plan (N04)

## current limitations

The current experiment surface is tightly coupled to the V3 contested-concept pilot pipeline and its evidence model.

Pilot-specific assumptions in the *config surface* ([config.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-prompts/src/run/config.ts), [experiments.ts](/Users/jesselee/dev/research/jg/judge-gym/apps/engine-convex/convex/models/experiments.ts)):

- Experiments are defined as `rubric_config + scoring_config` and stored that way in `experiments` rows. This structurally assumes a rubric-first flow and makes “no-rubric” tasks (direct labels, pairwise, replay) awkward or impossible without hacks.
- `rubric_config.concept` is a single free-text string treated as the primary object being evaluated (contested-concept framing).
- `rubric_config.scale_size` assumes an ordinal stage scale and implies “stage geometry” as the universal output space.
- `scoring_config.evidence_view` is hard-wired to the news-window semantic pipeline (`l0_raw/l1_cleaned/l2_neutralized/l3_abstracted`), which is not a valid abstraction for imported benchmark examples, survey items, or paper datasets.
- `scoring_config.evidence_bundle_size` + `bundle_strategy` are tuned to “windows bundled into bundles” and to the existing clustering/bundle-plan ecosystem (`window_round_robin`, `semantic_cluster`, etc.), rather than a general “grouping policy over arbitrary evidence items”.
- `scoring_config.method` (`single|subset`) and `abstain_enabled` assume the *only* scoring action is selecting rubric stage identifiers (possibly multiple) with an optional abstention gate.
- Randomization modes are rubric-presentation-specific (`anonymize_stages`, `shuffle_rubric_order`, `hide_label_text`), but paper audits often need different randomizations (answer-order swaps, label-order randomization, prompt framing toggles, etc.).

Pilot-specific assumptions in the *prompt builders* ([builders.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-prompts/src/run/builders.ts)):

- Rubric generation explicitly targets “single article excerpt” adjudication and assumes cues like “actions, policies, institutional responses” and “regime diagnosis” disclaimers (good for the pilot; wrong defaults for many paper tasks).
- Scoring prompts assume the task is “evaluate evidence against a rubric provided by the user” and emit `VERDICT: <rubric id(s)>` or `ABSTAIN`. This is not the right contract for direct label coding, scalar ratings, pairwise preference, or baseline-faithful prompt replay where the output contract is defined by the paper.
- The stage model is implicitly fixed: rubric gen -> rubric critic -> score gen -> score critic (mirrored by [process.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-settings/src/process.ts) and the run counters in [experiments.ts](/Users/jesselee/dev/research/jg/judge-gym/apps/engine-convex/convex/models/experiments.ts)).

Net: the current config surface is an excellent *contested concept + rubric-first + article-window* instrument (consistent with the pilot framing in [paper.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/paper.md) and the V3 ablation axes in [v3_gpt_ablations.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md)), but it does not cleanly cover V4’s second pillar: audits of published evaluator pipelines (as anticipated by the target triage reports: [paper-target viability](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-paper-target-viability/synthesis/final_report.md), [resource certainty](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-resource-certainty/synthesis/final_report.md)).

## proposed config model

Goal: a generalized V4 experiment surface that separates (and therefore makes composable) the following concerns:

- evidence universe
- task family
- adjudication task
- rubric generation policy
- scoring regime
- provider execution settings
- aggregation/reporting
- reproducibility controls

### V4 top-level shape (conceptual)

```ts
type ExperimentSpecV4 = {
  id: string; // stable experiment tag
  metadata: {
    study: "v3" | "v4" | string;
    purpose: "contested_concept_study" | "paper_audit" | "benchmark_audit" | string;
    description?: string;
    audit_target?: { paper_id: string; pipeline_id: string } | null;
  };

  evidence_universe: EvidenceUniverseSpec;
  task_family: TaskFamilySpec;
  adjudication_task: AdjudicationTaskSpec;

  rubric_policy: RubricPolicySpec;          // may be "none"
  scoring_regime: ScoringRegimeSpec;        // output + parsing + abstention + confidence
  execution: ProviderExecutionSpec;         // per-stage model + runtime knobs

  aggregation_reporting: AggregationReportingSpec; // geometry + paper-specific metrics
  reproducibility: ReproducibilitySpec;     // seeds + hashes + version pins
};
```

### Evidence universe (what is being judged)

Key design constraint for V4: the engine should not assume “article window” or “l0-l3”. Instead, the experiment defines:

- `universe_ref`: where the items come from (`window_run_id`, `dataset_id`, `paper_artifact_bundle`, `benchmark_split`, etc.).
- `item_schema`: the typed fields available for prompting (e.g., `text`, `question`, `answer_a`, `answer_b`, `coder_instructions`, `metadata`).
- `views/renderers`: named renderings of the same item for use in prompts (e.g., `raw_text`, `cleaned_text`, `neutralized_text`, `paper_original_view`, `minimal_view`), with a default per-stage mapping.
- `selection`: sampling/stratification and “matched sample ordinal” controls (carry forward the V3 matched-sample emphasis).
- `grouping`: generic “grouping policy” over items (bundle size, deterministic grouping seed, group labels), which can be implemented by bundle plans when available but does not require a window-centric worldview.

### Task family (why/for whom we are judging)

This is a coarse categorization that drives defaults and reporting expectations, not the actual prompt:

- `contested_concept`: geometry-first, regime-sensitive, evidence-bundle policies are part of the instrument.
- `paper_audit`: baseline-faithfulness and “pipeline reconstruction validity” are first-class outcomes; perturbations are explicitly labeled as deviations.
- `benchmark_audit`: tasks resemble standard eval items (instruction, reference, candidate outputs); pairwise and scalar ratings common.
- `survey_opinion_audit` (expansion lane per the triage reports): opinion/stance/rating tasks where the “rubric” may be a codebook or a Likert scale and where “outside knowledge” rules differ.

### Adjudication task (the question and label space)

This must become explicit and independent of rubrics:

- `input_contract`: which evidence fields and renderers are used.
- `output_space`: one of:
  - `ordinal_stages` (rubric stages)
  - `categorical_single` (one label)
  - `categorical_multi` (subset / multi-label)
  - `scalar_rating` (e.g., 1-5 with anchors)
  - `pairwise_preference` (A/B/tie + optional strength)
  - `freeform_extraction` (coded spans, rationales) with a strict JSON contract
- `abstention_policy`: none, allowed, required-on-uncertainty, or paper-defined (some papers force a label).
- `explanation_policy`: none, brief rationale, or “paper-faithful” (if the paper did or didn’t require rationales).

Importantly: “concept” becomes one possible adjudication variable, not the defining axis of the entire engine.

### Rubric generation policy (where the rubric comes from)

Rubric should become a pluggable artifact:

- `source`:
  - `generated` (current behavior)
  - `imported` (paper-provided rubric/codebook)
  - `frozen_artifact` (hash-addressed rubric text)
  - `none` (tasks without rubrics)
- `format`: stage rubric, label list with definitions, codebook sections, pairwise criteria, etc.
- `quality_controls`: critic stage on/off, constraints, rubric validation/parsing.
- `presentation_randomization`: label anonymization/order shuffle/etc (only when relevant).

### Scoring regime (how scoring is executed and parsed)

This is the core generalization point. It must define:

- `prompt_policy`: whether prompts are judge-gym templates vs faithful replay of paper templates.
- `output_contract`: canonical machine-parseable output (recommend: JSON with a single required terminal marker line to reduce drift).
- `postprocessing`: paper-defined mapping steps (regex normalization, label remapping, tie-breaking).
- `uncertainty_capture`: optional confidence fields, calibration prompts, or second-pass verification.
- `critic_policy`: optional “agreement / audit” critic, but generalized beyond “expert agreement with a rubric verdict”.

### Provider execution settings (per-stage runtime knobs)

This should be expressed as “execution intents”, not OpenAI semantics:

- per-stage model selection (provider + model id)
- temperature/top_p/max_tokens, tool-use allowed, retry policy
- batching/caching hints (capability-aware)
- concurrency quotas

Even if the runtime remains OpenAI-centric short-term, the experiment surface should already be provider-neutral so paper-audit configs do not embed OpenAI-only fields.

### Aggregation/reporting (what we compute and present)

Split “contested concept geometry” reporting from “paper audit validity” reporting:

- `primary_endpoints`: which summaries are “headline” for this experiment.
  - contested concept: abstain rate, singleton rate, subset size, expected stage, stage entropy, etc. (carry forward V3’s geometry-first hierarchy)
  - paper audit: baseline-faithfulness checks (prompt match, output format match, label distribution match), plus paper-native metrics (accuracy/F1/win-rate/etc) where applicable
- `aggregation_methods`: linear pool/log pool/belief diagnostics only when the output space supports it (not assumed globally)
- `strata`: group-by dimensions (concept, prompt variant, model placement, evidence view, dataset split, etc.)

### Reproducibility controls

V4 needs explicit “replayability” levers for both lanes:

- `rng`: global experiment seed plus named seeds for grouping/randomizations
- `artifact_pins`: prompt template ids + versions, rubric hash, dataset hash/snapshot id, codebook version
- `compat_mode` for audits: “paper-faithful” toggles that lock down anything the paper specified (prompt text, separators, output parsing), and a clear audit trail when deviations are introduced

## stage/prompt generalization

### Generalize from fixed stages to a stage plan

Current fixed run stages (`rubric_gen`, `rubric_critic`, `score_gen`, `score_critic`) are sufficient for the contested-concept pilot but not for paper audits.

V4 should treat a run as executing a `StagePlan`:

- A list of named stages, each with:
  - `kind` (e.g., `rubric_generate`, `rubric_import`, `judge_score`, `judge_pairwise`, `verify_format`, `audit_agreement`, `calibrate`, `extract_labels`)
  - `inputs` (rendered evidence view + optional rubric/codebook + optional baseline prompt text)
  - `prompt_template` (judge-gym template or imported paper template)
  - `output_parser` (JSON schema or strict line contract)
  - `execution_profile` (which model/provider settings apply)

Engine core responsibility: execute the stage plan generically, store artifacts, enforce contracts, and handle retries.

Experiment config responsibility: define the stage plan, prompts, variables, and parsers.

### Prompt families to add for paper-audit targets

Paper audits will commonly require at least three additional “prompt families” beyond rubric-first scoring:

1. Direct label coding (codebook-driven, no rubric generation)
   - Input: item + codebook (imported) + paper’s coder instructions.
   - Output: `label` (single or multi) and optional structured justification if the paper required it.

2. Pairwise judgment / preference
   - Input: question/context + response A + response B + judging criteria (paper-provided).
   - Output: `winner: A|B|TIE` plus optional strength/confidence.
   - Randomization: deterministic A/B swap; store swap in metadata.

3. Baseline-faithful prompt replay
   - Input: exact paper prompt template(s), including quirks (delimiters, examples, “assistant:” prefixes, etc.).
   - Output: paper-native contract (may be freeform), plus a normalization/postprocess step to map into a comparable label space.
   - Critical: separate “replay fidelity” checks (did we match the prompt?) from “judge behavior” outcomes.

### Keep contested-concept flow as a first-class lane, not a special case

The existing rubric-first flow remains one `StagePlan` preset:

- `rubric_generate` (generated rubric policy)
- `rubric_quality_audit` (optional)
- `judge_score_against_rubric` (single/subset + abstention)
- `audit_expert_agreement` (optional)

But it should be parameterized by:

- evidence renderers (not hard-coded `l0-l3`)
- verdict space (not assumed to be “ordinal stages” in all experiments)
- output contract (prefer JSON to reduce parsing fragility as task families diversify)

## compatibility strategy

Recommended sequence that introduces the new config surface without breaking ongoing V3/V4 work:

1. Add (conceptually) a V4 `ExperimentSpecV4` alongside the existing `ExperimentConfig` shape, with an adapter that compiles:
   - `ExperimentConfig` -> `ExperimentSpecV4` using the existing rubric-first `StagePlan` preset.
   - This keeps current experiments runnable while letting new experiments target the V4 surface.

2. Introduce `rubric_policy.source = imported|frozen|none` without changing the engine core stage runner:
   - First support “imported rubric, same scoring prompt”, which is the smallest bridge toward audits.

3. Add paper-audit `StagePlan` presets in prompts/config only:
   - `direct_label_coding`
   - `pairwise_preference`
   - `prompt_replay`
   Keep the core runner generic; do not bake paper-specific logic into the engine.

4. Only after (1)-(3) stabilize, migrate storage/schema gradually:
   - Store V4 experiment specs as a versioned blob (with validation) rather than `rubric_config/scoring_config` columns as the canonical form.
   - Maintain legacy columns (or a derived projection) for V3 analysis continuity until the analysis stack is updated.

## risks and open questions

- Stage identity: If the engine continues to use a fixed `RunStageKey` enum, V4 will either need an “extensible stage registry” or a “single generic stage with substage metadata”. Either choice has implications for UI, counters, and control commands.
- Output contracts: Moving to JSON contracts improves robustness but may reduce baseline-faithfulness for papers that did not use JSON. The surface should allow “paper-native + postprocess” while still recording a normalized canonical output.
- Evidence renderers: V4 needs a principled interface for “views/renderers” that can represent both (a) derived evidence transforms (clean/neutralize/abstract) and (b) paper-specific formatting quirks. Where these live (engine core vs prompts package) needs a clean seam.
- Fairness in audits under model/API drift: “paper-faithful” cannot always mean “identical model”. The config surface must encode what is held fixed (prompt, parsing, labels) vs what is substituted (model family), and how that is reported.
- Reproducibility: hash-addressing prompts/rubrics/datasets is straightforward, but only if the experiment surface stops embedding large opaque strings ad hoc. This pushes toward an artifact registry concept and away from inline prompt text.
- Analysis coupling: V3’s geometry-first summaries assume a stage-based ordinal output space. Paper audits will require additional, paper-native metrics. The reporting config must declare which metrics are valid for which output spaces.

