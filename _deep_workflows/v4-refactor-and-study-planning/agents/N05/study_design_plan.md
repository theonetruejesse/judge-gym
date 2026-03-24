# V4 Study Design Plan (Self-Contained Paper)

## Thesis And Contribution Claims

**Core thesis (paper-level):** LLM-as-judge results are properties of *configured evaluator regimes* (model + prompts + abstention policy + scale + evidence presentation + grouping + aggregation), not properties of “the model” alone. Consequently, published conclusions that treat the evaluator as a neutral instrument can be fragile: modest, plausible evaluator perturbations can produce materially different *adjudicative geometry* (abstention, occupancy, breadth, entropy, etc.) and sometimes different practical conclusions.

**Contribution claims (what V4 can credibly claim as a standalone paper):**

1. **An audit protocol for evaluator regimes.**
   - Separate “faithful reconstruction of the original evaluator pipeline” from a controlled “regime perturbation sweep”.
   - Use matched example IDs as the unit of comparison (avoid pooled-only reporting).

2. **A measurement language for evaluator behavior.**
   - Geometry-first endpoints: abstain mass, scale occupancy (incl. mid-scale), singleton/subset rate, mean subset size, expected stage, stage entropy.
   - Treat evidence grouping (bundle plans) as part of the measurement instrument, not a preprocessing footnote.

3. **Empirical evidence across multiple externally legible case studies.**
   - Audit at least two high-visibility published pipelines (launch bundle below).
   - Include one mainstream comparator (benchmark-style) to show generality beyond contested social concepts.

4. **Provider-expansion as a methodological control, not a feature.**
   - Demonstrate that regime sensitivity is not an artifact of one vendor’s API semantics by running the same regime audits across OpenAI + Anthropic + an OpenRouter-backed model slice.

## Recommended Study Matrix

### Launch Bundle (first-wave paper bundle)

1. **Gilardi et al. (primary audit):** “LLMs as replacement for human coders” style pipeline.
   - Role in paper: highest external legibility; directly targets the “drop-in judge as neutral coder” assumption.

2. **Ziems et al. (scoped subset audit):** broad social-science LLM coding family, but V4 audits a precommitted subset.
   - Role in paper: shows the audit protocol scales beyond a single paper, while avoiding unfair whole-suite reconstruction claims.

3. **Comparator lane (choose one):**
   - **Zheng / MT-Bench (default):** canonical benchmark-style judging comparator.
   - **Thakur et al. (alternate):** strong public-materials comparator with a more controlled setup.
   - Role in paper: demonstrates regime-audit generalization outside contested political/social-science coding.

### Study Lanes (paper narrative lanes)

1. **Lane A: Faithful reconstruction (per target).**
   - Goal: establish a baseline run that is recognizably “the paper’s pipeline”, with documented drift caveats.
   - Output: reconstruction report + exact config manifest + sample list + evaluator prompt pack.

2. **Lane B: Regime perturbation sweep (per target).**
   - Goal: quantify how much evaluator regimes move under small, defensible perturbations.
   - Perturbations (recommended minimal set; keep it consistent across targets):
     - Abstention: `off` vs `on` (explicit abstain policy).
     - Scale: original vs one larger ordinal variant (if original is binary/ternary).
     - Evidence view: original vs one standardized alternate view (e.g., shorter/abstracted) when applicable.
     - Grouping: singleton vs bundle plan (random baseline + semantic cluster plan if feasible).
     - Model placement (when the pipeline has multiple LLM roles): swap rubric-generation vs scoring roles (or “judge vs summarizer” roles) where meaningful.

3. **Lane C: Provider-family control (cross-cutting).**
   - Goal: show that the same perturbations induce regime movement across distinct providers, not just across model IDs within one provider.
   - Provider wave 1 (required for V4 paper claim set):
     - **OpenAI:** continuity with existing engine and the current strongest baseline.
     - **Anthropic:** distinct safety/refusal behavior, different system/tooling semantics, and a major non-OpenAI frontier family; it is the cleanest “different lab” control.
     - **OpenRouter:** the fastest path to multi-family coverage (open-weight and additional closed models) through one integration surface; also stress-tests that “provider” is a capability surface, not just a list of model IDs.

### Concrete matrix (recommended minimum)

For each **target** in `{Gilardi, Ziems(subset), Comparator}`:

- **Baseline:** 1 faithful reconstruction regime.
- **Perturbations:** 4 perturbation families above (abstain, scale, grouping, model placement where applicable).
- **Providers/models:** at minimum 1 OpenAI model, 1 Anthropic model, and 1 OpenRouter-accessed model.

This yields a paper-realistic grid:

- 3 targets
- 1 baseline + ~4 perturbation families (not necessarily full factorial; matched contrasts are the unit)
- 3 provider slices

V4 should privilege *matched contrasts* (“change one lever at a time”) over a full-cross product.

## Scope / Defer Decisions

### In-scope for the first V4 paper

- **A tight, auditable shortlist:** Gilardi + scoped Ziems + one comparator (Zheng/MT-Bench by default).
- **Protocol clarity:** explicit separation of faithful reconstruction vs perturbation sweep.
- **Geometry-first primary endpoints:** tables and figures centered on regime geometry, not only agreement/accuracy.
- **Bundle plans as first-class objects:** at least one random baseline bundle plan and one structured bundle plan where applicable.
- **Provider expansion wave 1:** OpenAI + Anthropic + OpenRouter demonstrated on the same audit protocol.
- **Fairness-of-reconstruction safeguards:**
  - precommitted Ziems subset rule (written before looking at outcomes),
  - explicit drift caveats (API/model version drift, prompt lossiness, missing artifacts).

### Explicitly deferred (state plainly in paper)

- **Systematic literature review / broad sweep.** V4 is a method + case-study paper, not a census.
- **Full-suite Ziems replication.** Only a subset is audited; the rest is future work.
- **Santurkar et al. as a main target.** Reserve for an expansion wave because it forces higher-lift evidence semantics (survey weighting, demographic strata, distributional comparisons).
- **Conditional targets (e.g., Tornberg) until bundle inspection is done.**
- **Human re-annotation / “ground truth” validity as a primary claim.** The paper audits evaluator regimes; it does not claim to establish correctness of contested labels.
- **Many-provider expansion (Google, xAI, etc.) and heavy open-weight training.** Not needed for first-wave claims.
- **Mechanistic interpretability explanations.** Keep the paper empirical and protocol-driven.

## Engine Dependencies (Mapped To Refactor Tracks)

This section is the “study design -> required refactor” map. The lead agent should treat these as non-negotiable for the launch bundle.

### A_evidence_schema (EvidenceUniverse generalization)

Required to support paper audits without pretending everything is a news window.

- **EvidenceUniverse:** unified representation for:
  - paper datasets (labeled examples, codebook-coded items),
  - benchmark examples (pairwise comparisons, multi-turn dialogs),
  - model outputs (for judge-over-outputs setups),
  - optional news/articles for contested-concept stress tests.
- **Source metadata + sample identity:** stable `sample_id` and provenance so “matched sample” comparisons are first-class.
- **Evidence views:** renderers for “verbatim”, “short”, “abstracted”, “fields-only”, etc., controlled by config.
- **Bundle plans:** reusable, versioned bundle definitions over an evidence universe (random baselines + structured grouping plans).

### A_provider_runtime (Provider capability layer)

Needed so “provider expansion” is scientific control rather than a bespoke integration.

- **Capability matrix:** encode differences like batching, caching, file upload, tool invocation semantics, and rate limits as capabilities, not ad hoc per-provider codepaths.
- **Transport adapters:** OpenAI, Anthropic, OpenRouter as first-class providers (with model IDs and pricing treated as data/config, not hard-coded).
- **Execution policy abstraction:** “batchable vs non-batchable” as a runtime decision tied to provider capabilities.
- **Reproducibility logging:** capture provider, model, request params, and any provider-specific metadata needed to interpret drift.

### A_experiment_prompt_surface (Study configuration surface)

Needed so “faithful reconstruction” and “perturbation sweep” are encoded as data, not bespoke scripts.

- **Task-family config:** represent “paper audit task families” separately from “contested concept judging”.
- **AdjudicativeRubric as a structured object:** codebook-driven rubric construction + explicit abstention + explicit scale policy.
- **ScoringRegime:** explicit model placement (rubric vs scoring roles), aggregation method, grouping policy, ordering controls.
- **Audit stage separation:** configuration must express:
  - `reconstruction_mode = faithful`,
  - `audit_mode = perturbation`,
  - with shared sample sets and explicit deltas.

## Immediate Planning Deliverables (Lead Agent Should Generate Now)

1. **One-page V4 paper outline** (sections + figures, with the three case-study targets and the audit protocol as the organizing spine).
2. **Launch-bundle decision memo** locking `{Gilardi, Ziems(subset), Comparator}` and the role of each target in the argument.
3. **Ziems subset selection spec** (precommitted rule + exact subset list + justification against cherry-picking).
4. **Comparator decision memo** choosing `Zheng/MT-Bench` vs `Thakur` with a single-sentence rationale and a deferral plan for the other.
5. **V4 study matrix sheet** listing:
   - baseline reconstruction config per target,
   - perturbation contrasts per target,
   - provider/model slices,
   - primary endpoints and pass/fail sanity checks.
6. **Engine refactor requirements doc** mapping the above matrix to:
   - evidence primitives,
   - provider capability requirements,
   - experiment-config fields,
   - required logging for reproducibility.
7. **Artifact inspection checklist** for replication bundles (what must be present for “fair reconstruction”), to raise/lower certainty before implementation time is spent.

_deep_workflows/v4-refactor-and-study-planning/agents/N05/study_design_plan.md
