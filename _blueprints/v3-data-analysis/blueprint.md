# Blueprint: V3 Data Analysis

> The V3 pilot should be analyzed as a matched intervention matrix, not as a pooled notebook. The report should center on adjudicative-geometry shifts within experiment families, use SQLite-backed derived tables as the main mining surface, and treat exploratory discovery separately from confirmatory claims. The strongest early candidates for a first report are the bundle families (`a6/a7`), the abstain toggle (`a1`), the rubric-vs-scorer swap (`a4`), and the control family (`d1`) as an interpretability anchor. This document is a prebuilt implementation plan for turning the current cache and output scaffolding into a reproducible report pipeline. Evidence is grounded in the knowledge entries under `knowledge/`, the null challenge artifact, the certainty report, prior pilot documents, and the current V3 overview tables.

This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-data-analysis
- **Research Question:** How should judge-gym analyze the completed V3 pilot matrix so the team can mine robust findings, compare experiment families, and generate a comprehensive markdown report with reproducible tables/plots from the SQLite-backed analysis cache?
- **Scope:** report architecture; matched-family inference; derived analysis tables; exploratory mining strategy; visualization/report structure; current V3 priority findings.
- **Non-goals:** new engine changes; new experiment launches; new data collection; methodological claims beyond what the pilot can support.
- **Constraints:** no notebooks in the execution phase; work off the SQLite-backed cache and generated outputs; preserve reproducibility; treat belief/conflict metrics cautiously; keep exploratory and confirmatory claims clearly separated.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` is the registry for subagent assignments, evidence, and synthesis status.

- **Agent Registry:** lead, researchers, falsifier, certainty scorer, synthesizer
- **Assignments:** four Areas of Analysis (`A_01` through `A_04`)
- **Evidence Registry:** `knowledge/k_001_pilot_framing_evidence.md`, `knowledge/k_002_statistical_methods_evidence.md`, `knowledge/k_003_mining_visualization_evidence.md`, `knowledge/k_004_current_v3_signal_scan.md`
- **Hypotheses Registry:** four micro-hypotheses in `hypotheses/`
- **Null Challenges:** `null_challenges/nc_v3_analysis_hypotheses.json`
- **Certainty Report:** `certainty/certainty_report.md`

---

## 2. Evidence Ledger (Grounding)

- **`k_001` Pilot framing and report architecture**
  - V2’s strongest narrative frame is adjudicative geometry, with explicit descriptive caveats and strong limitations; V3 should preserve that framing but reorganize around family-level matched effects rather than pooled charts.
  - V3 already exposes normalized family structure (`family_slug`) and comparable experiment metadata in the overview tables. See `knowledge/k_001_pilot_framing_evidence.md`.

- **`k_002` Statistical methods for matched-family inference**
  - The correct inferential default is paired/matched analysis at the sample level within families, using paired bootstrap CIs and paired permutation/sign-flip checks, with simple mixed models and variance decomposition as secondary tools.
  - This only holds if the matching assumptions are validated first. See `knowledge/k_002_statistical_methods_evidence.md`.

- **`k_003` Insight mining and visualization strategy**
  - Discovery should be table-driven and ranked: sample instability, evidence sensitivity, and family deltas first; hero plots second.
  - Distance maps and clustering are exploratory navigation tools only and require explicit stability checks. See `knowledge/k_003_mining_visualization_evidence.md`.

- **`k_004` Current V3 signal scan**
  - The best first-report candidates are `a6/a7`, `a1`, `a4`, with `d1` as a sanity anchor.
  - Conflict metrics are informative but currently risky as headline endpoints because they saturate for many families. See `knowledge/k_004_current_v3_signal_scan.md`.

**Critical gaps / missing evidence:**
- We do not yet have proof that `sample_ordinal` is a valid matching key across all intended within-family contrasts.
- We do not yet have derived tables for `sample_metrics`, `evidence_metrics`, or `family_pair_deltas`, which means current discovery still leans too much on coarse experiment-level summaries.
- The current belief/conflict metrics may be too aggregation-sensitive to act as primary endpoints without sensitivity analysis.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Prior pilot framing and report architecture | Ohm | `k_001` |
| A_02 | Matched-sample statistical inference | Plato | `k_002` |
| A_03 | Insight mining and visualization strategy | Erdos | `k_003` |
| A_04 | Current V3 signal scan and priority findings | Noether | `k_004` |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| `h_A_01_001` | The correct V3 report architecture is global overview + matched within-family effects + experiment drilldowns/case studies, with explicit exploratory vs confirmatory labeling. | `k_001` | 0.75 |
| `h_A_02_001` | Paired/matched sample-level inference will be more reliable than per-experiment mean comparisons if matching is verified. | `k_002` | 0.72 |
| `h_A_03_001` | Ranked instability/sensitivity tables will surface more stable findings than browsing aggregate charts, and distance maps are useful only as exploratory navigation. | `k_003` | 0.70 |
| `h_A_04_001` | The first report should prioritize `a6/a7`, `a1`, and `a4`, with `d1` as an interpretability anchor. | `k_004` | 0.74 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| `h_A_01_001` | Passed with caveats | Architecture alone does not remove forking-paths risk; needs frozen endpoint and baseline policies. |
| `h_A_02_001` | Passed with caveats | Pairing can fail if `sample_ordinal` is not truly matched; permutation assumptions are not automatic. |
| `h_A_03_001` | Passed with caveats | Ranked tables still encode analyst choices; cluster maps can be unstable or invalid. |
| `h_A_04_001` | Passed with caveats | `a6/a7` may look special partly because they have different denominators (`120` vs `600` responses), which affects conflict saturation. |

See `null_challenges/nc_v3_analysis_hypotheses.json`.

---

## 6. Certainty Scoring Summary

- **Method:** isolated certainty scorer reviewed the local evidence memos, hypotheses, pilot docs, and current V3 outputs only.
- **Report:** `certainty/certainty_report.md`
- **Highest-confidence items:**
  - validate matching assumptions before inference (`0.90`)
  - add derived SQLite tables for sample/evidence/family deltas (`0.85`)
  - deterministic markdown report assembly (`0.86`)
- **Lowest-confidence items:**
  - using clustering/MDS as more than exploratory maps (`0.60`)
  - treating conflict as a primary endpoint without sensitivity analysis
  - adjusting for rubric quality as if it were a pre-treatment covariate
  - assuming pairing is valid without explicit verification

---

## 7. Prebuilt Implementation Plan

Each step cites evidence, specifies outputs, and includes verification criteria. This plan is intended to be executed without re-deriving decisions.

### Step Template

- **Step ID / Name:** [e.g., S1: Initialize Data Model]
- **Objective:** [What this step achieves]
- **Evidence to Review:** [k_...]
- **Inputs:** [Files, configs, dependencies]
- **Actions:**
  1. [Concrete action]
  2. [Concrete action]
- **Outputs:** [New files, updated records]
- **Verification:** [Tests, checks, or acceptance criteria]
- **Risks/Assumptions:** [What could invalidate this step]
- **Confidence:** [0.0-1.0]

### Steps

#### S1: Validate Matching Assumptions And Contrast Definitions

- **Objective:** Prove which within-family comparisons are genuinely matched, and define the canonical baseline for each family before any inferential work.
- **Evidence to Review:** `k_001`, `k_002`, `k_003`, `k_004`, `nc_v3_analysis_hypotheses.json`
- **Inputs:** SQLite cache, current export tables, family membership table, experiment manifests.
- **Actions:**
  1. For each intended family contrast, compute per-sample comparability checks:
     - evidence label sets
     - window IDs
     - bundle cardinality
     - any available stable sample/evidence keys
  2. Mark each family contrast as one of:
     - fully matched at sample level
     - partially matched and requiring stratification / alternate unit
     - not safely matched and therefore descriptive only
  3. Define and freeze canonical baselines:
     - `a1`: abstain `false` as baseline within model
     - `a4`: treat each swap as a mechanism probe rather than a unidirectional “baseline”
     - `a6/a7`: baseline is the paired model-matched counterpart inside the family, not a cross-family pooled baseline
     - `d1`: use as interpretability anchor, not as universal baseline
- **Outputs:** matching-validation table; baseline-policy doc; family contrast registry.
- **Verification:** a reviewer can see exactly which families support paired analysis and why; every later script imports the same frozen contrast registry.
- **Risks/Assumptions:** if matching fails for major families, several planned inference steps must downgrade from paired to descriptive.
- **Confidence:** 0.90

#### S2: Materialize Derived Analysis Tables In SQLite

- **Objective:** Turn the current cache into a proper mining surface so insight discovery does not depend on chart inspection.
- **Evidence to Review:** `k_002`, `k_003`, `certainty/certainty_report.md`
- **Inputs:** `analysis_responses`, `analysis_rubrics`, `analysis_samples`, family contrast registry from S1.
- **Actions:**
  1. Add derived tables:
     - `sample_metrics`
     - `evidence_metrics`
     - `family_pair_deltas`
     - `experiment_distance_inputs`
  2. Recommended columns:
     - `sample_metrics`: `experiment_tag`, `family_slug`, `sample_ordinal`, abstain count/rate, singleton rate, mean subset size, expected stage, stage entropy, TBM conflict, closed-world conflict, bundle count
     - `evidence_metrics`: `experiment_tag`, `family_slug`, `sample_ordinal`, `bundle_label` or evidence label, abstain rate, expected stage, subset size, agreement/conflict summaries
     - `family_pair_deltas`: baseline tag, variant tag, family slug, sample ordinal, endpoint deltas
     - `experiment_distance_inputs`: experiment-level or sample-level feature vectors used for exploratory maps
  3. If needed, add `response_items` as an exploded convenience table for multi-evidence bundles.
- **Outputs:** deterministic derived tables stored in SQLite or exported CSV mirrors.
- **Verification:** aggregating `sample_metrics` and `family_pair_deltas` can reproduce current overview metrics; row counts align with validated denominators from S1.
- **Risks/Assumptions:** if bundle families do not normalize cleanly to the same unit, the table design must explicitly encode non-comparability.
- **Confidence:** 0.85

#### S3: Freeze The Endpoint Policy

- **Objective:** Separate primary endpoints from secondary diagnostics so the report has discipline and does not drift into metric cherry-picking.
- **Evidence to Review:** `k_001`, `k_002`, `k_004`, `certainty/certainty_report.md`, `nc_v3_analysis_hypotheses.json`
- **Inputs:** derived tables from S2; current overview metrics.
- **Actions:**
  1. Define a small primary endpoint panel, recommended:
     - abstain rate
     - singleton rate
     - mean subset size
     - expected stage or calibrated severity score
     - one instability metric that is not solely TBM conflict
  2. Define secondary diagnostics:
     - TBM conflict
     - closed-world conflict
     - distance/clustering outputs
     - rubric observability/discriminability
  3. Freeze multiplicity policy:
     - exploratory panels use BH-FDR for prioritization
     - limited confirmatory headline claims can use Holm-adjusted tests if needed
  4. Freeze abstention treatment policy per endpoint.
- **Outputs:** endpoint-policy markdown or JSON artifact checked into analysis outputs.
- **Verification:** every figure and table in the report references either a primary endpoint or a secondary diagnostic label.
- **Risks/Assumptions:** if the primary severity endpoint changes later, all deltas and stories must be rerun and relabeled.
- **Confidence:** 0.78

#### S4: Compute Family-Level Matched Effects

- **Objective:** Produce the core numerical results for the report: within-family deltas, uncertainty intervals, and simple significance checks where appropriate.
- **Evidence to Review:** `k_002`, `k_004`, `h_A_02_001`, `nc_v3_analysis_hypotheses.json`
- **Inputs:** validated contrast registry; `sample_metrics`; endpoint policy.
- **Actions:**
  1. For each valid family contrast, compute sample-level deltas for each primary endpoint.
  2. Estimate uncertainty using paired bootstrap CIs over samples.
  3. For a limited subset of headline contrasts, run paired permutation/sign-flip checks.
  4. Emit a `family_effects` table with:
     - effect estimate
     - CI
     - p-value or permutation summary if used
     - sample count
     - directionality
  5. Run alternative aggregations where needed:
     - median instead of mean
     - trimmed means
     - denominator-normalized versions for bundle families
- **Outputs:** `family_effects.csv`; family-level summary JSONs.
- **Verification:** bootstrap and permutation directionality agree for the main families; non-comparable families are explicitly marked as descriptive-only.
- **Risks/Assumptions:** confidence intervals will be too optimistic if S1 matching fails or if resampling units are wrong.
- **Confidence:** 0.80

#### S5: Run Robustness And Sensitivity Analyses

- **Objective:** Stress-test the most interesting findings so the report does not mistake aggregation artifacts for substantive insight.
- **Evidence to Review:** `k_002`, `k_004`, `nc_v3_analysis_hypotheses.json`, `certainty/certainty_report.md`
- **Inputs:** `family_effects`, belief/conflict summaries, rubric quality metrics.
- **Actions:**
  1. Recompute key family contrasts under alternative belief/conflict treatments:
     - with and without abstentions
     - alternative conflict filtering
     - fixed-size subsampling for denominator-equalized conflict comparisons
  2. Treat rubric quality as:
     - descriptive mediator
     - stratification variable
     - optional sensitivity-analysis regressor
     rather than a default adjustment covariate
  3. Quantify whether the main findings survive these variants.
- **Outputs:** robustness appendix tables; a short “what changed under sensitivity analysis” summary.
- **Verification:** prioritized findings (`a6/a7`, `a1`, `a4`) still show the same broad ordering or are explicitly downgraded.
- **Risks/Assumptions:** if the prioritized effects vanish under simple denominator-equalization or abstention policy changes, the narrative must change.
- **Confidence:** 0.74

#### S6: Build Ranked Mining Tables

- **Objective:** Create an automated discovery layer that surfaces interesting samples, evidence bundles, and family contrasts before any figure curation.
- **Evidence to Review:** `k_003`, `h_A_03_001`, `certainty/certainty_report.md`
- **Inputs:** `sample_metrics`, `evidence_metrics`, `family_pair_deltas`.
- **Actions:**
  1. Create ranked outputs:
     - `sample_instability.csv`
     - `evidence_sensitivity.csv`
     - `candidate_findings.csv`
  2. Score candidates by:
     - effect magnitude
     - uncertainty
     - robustness across alternate aggregations
     - cross-model consistency or interaction effects
  3. Include provenance fields so each ranked item links back to samples and source tables.
- **Outputs:** ranked discovery tables; optionally a `candidate_findings.md` summary.
- **Verification:** the top-ranked items correspond to interpretable patterns and can be reproduced by rerunning the same scripts from the same cache snapshot.
- **Risks/Assumptions:** ranking still encodes analyst choice; the ranking policy must be frozen and logged.
- **Confidence:** 0.75

#### S7: Generate Hero Visuals And Exploratory Maps

- **Objective:** Render a compact set of visuals that explain the strongest findings without turning the report into an image dump.
- **Evidence to Review:** `k_001`, `k_003`, `k_004`, `nc_v3_analysis_hypotheses.json`
- **Inputs:** `family_effects`, ranked mining tables, distance inputs.
- **Actions:**
  1. Primary visuals:
     - paired delta plots by family
     - sample-level heatmaps for top family effects
     - evidence/bundle driver plots
     - experiment metric overview heatmap
  2. Secondary exploratory maps:
     - clustered heatmap of experiment distances
     - 2D MDS map
     - only if stability diagnostics are acceptable
  3. Keep each figure tied to one explicit analytic question.
- **Outputs:** final figure set in the report outputs folder; a figure manifest.
- **Verification:** every figure corresponds to a ranked or primary endpoint result; exploratory maps are explicitly labeled and not used as headline proof.
- **Risks/Assumptions:** clustering and MDS can be unstable and should be dropped if the stability checks fail.
- **Confidence:** 0.60 for exploratory maps; 0.80 for paired-delta and heatmap visuals.

#### S8: Assemble The Markdown Report

- **Objective:** Produce the comprehensive report the user asked for: generated markdown with embedded images, explicit findings, and transparent caveats.
- **Evidence to Review:** `k_001` through `k_004`, null challenges, certainty report, all output tables/figures.
- **Inputs:** summary tables, hero visuals, family effects, ranked mining tables.
- **Actions:**
  1. Write report sections:
     - Executive summary
     - Setup and methodological caveats
     - Global overview
     - Family analyses (`a6/a7`, `a1`, `a4`, then secondary families)
     - Case studies (top unstable samples / most intervention-sensitive evidence)
     - Limitations and open questions
     - Appendix with per-experiment drilldowns
  2. For every headline claim, include:
     - linked figure/table
     - whether it is exploratory or confirmatory
     - one-sentence caveat if appropriate
  3. Include a short methodology box explaining why conflict is secondary and why pairing required validation.
- **Outputs:** one generated markdown report and associated image/table assets.
- **Verification:** every claim is traceable to artifacts and the report is fully regenerable from the cache snapshot.
- **Risks/Assumptions:** if too many findings remain exploratory-only, the report may need to emphasize method development and candidate findings more than substantive conclusions.
- **Confidence:** 0.86

#### S9: Optional Mixed-Effects And Variance-Decomposition Appendix

- **Objective:** Add a more model-based appendix once the table-driven analysis is stable.
- **Evidence to Review:** `k_002`, `certainty/certainty_report.md`
- **Inputs:** validated derived tables; endpoint policy.
- **Actions:**
  1. Fit simple random-intercept mixed models for a few primary endpoints.
  2. Estimate variance partitioning across sample, evidence/bundle, and configuration.
  3. Use this appendix to explain where variability lives, not to replace the primary descriptive report.
- **Outputs:** appendix tables and narrative.
- **Verification:** model-based directionality matches the paired effect estimates; convergence is stable.
- **Risks/Assumptions:** model misspecification and small-n brittleness make this secondary rather than required.
- **Confidence:** 0.66

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** each implementation step cites at least one knowledge entry or certainty/null artifact.
2. **Matching Gate:** no paired inference may run until S1 marks that contrast as matched or partially matched with explicit caveats.
3. **Conflict Gate:** no headline claim may rely solely on TBM/closed-world conflict without a sensitivity analysis.
4. **Multiplicity Gate:** every statistical table states whether it is exploratory (BH/FDR-ranked) or a limited confirmatory contrast.
5. **Reproducibility Gate:** every derived table, figure, and markdown report reruns from the same cache snapshot without manual intervention.
6. **Null Challenge Gate:** all main hypotheses remain marked “passed with caveats,” not “passed unconditionally.”

---

## 9. Open Questions

- What is the best primary severity endpoint for V3: expected stage, modal stage, or a calibrated severity score?
- Should abstentions be modeled as a separate outcome, mapped to uncertainty, or excluded from severity summaries depending on endpoint?
- Which family baselines should be canonical in the public-facing report versus only in internal analysis?
- Can bundle families (`a6/a7`) be normalized cleanly enough to compare their instability metrics directly against singleton families, or should they remain a separate analytic regime?
- Is rubric quality best treated as a descriptive mediator, a stratification factor, or deferred to a later dedicated mediation study?

---

## Appendix: Sources

- `knowledge/k_001_pilot_framing_evidence.md`
- `knowledge/k_002_statistical_methods_evidence.md`
- `knowledge/k_003_mining_visualization_evidence.md`
- `knowledge/k_004_current_v3_signal_scan.md`
- `null_challenges/nc_v3_analysis_hypotheses.json`
- `certainty/certainty_report.md`
- `docs/pilots/v2_engine_prototype_testing.md`
- `docs/pilots/paper.md`

