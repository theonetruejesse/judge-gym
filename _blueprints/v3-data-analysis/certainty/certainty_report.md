# Certainty Report

This report scores (a) evidence memos, (b) micro-hypotheses, and (c) likely next implementation steps for V3 analysis. It is intentionally conservative: anything that hinges on unverified matching assumptions, saturated metrics, or causal interpretation gets penalized.

Scoring scale:
- `0.9+`: very likely correct/robust in this project context
- `0.7-0.9`: likely correct, some important caveats
- `0.5-0.7`: plausible, but meaningful risk of being misleading without added verification
- `<0.5`: high risk / speculative

## Evidence Scores

- `k_001_pilot_framing_evidence`: **0.80**
  - Rationale: grounded strongly in local project docs ([docs/pilots/v2_engine_prototype_testing.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v2_engine_prototype_testing.md), [docs/pilots/paper.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/paper.md)) and current V3 summary tables. External references (ASA p-values; model cards; preregistration) are directionally appropriate but not essential to correctness.

- `k_002_statistical_methods_evidence`: **0.76**
  - Rationale: the core recommendations (paired bootstrap, paired permutation, mixed-effects random intercepts, variance partitioning) are standard and match the stated design (30 matched samples). Primary risk is *design mismatch*: if `sample_ordinal` is not truly matched across experiments (or if evidence differs materially per experiment), the “paired” framing can understate uncertainty.

- `k_003_mining_visualization_evidence`: **0.72**
  - Rationale: guidance is methodologically sound (table-driven mining, avoid forking paths, treat clustering as exploratory). The risk is operational: the current exported tables are not yet rich enough to support the full mining plan without additional derived tables (sample/evidence metrics, response-item explosion).

- `k_004_current_v3_signal_scan`: **0.66**
  - Rationale: the prioritization claims match what’s visible in the current V3 overview tables (e.g., `a6/a7` low conflict relative to the rest; `d1` extreme abstention), but it leans on two fragile assumptions:
    1. that the conflict metrics are comparably interpretable across families (they may not be, especially with bundling and conjunction rules),
    2. that rubric quality can be treated as a “covariate” without introducing post-treatment bias (depends on estimand).
  - Net: useful as a triage heuristic, not as evidence of substantive mechanism.

## Hypothesis Scores

- `h_A_01_001` (report architecture: overview + matched family effects + drilldowns): **0.82**
  - Rationale: low-risk and consistent with the project’s documented intent (design-space engine + geometry framing). Even if some metrics evolve, this structure remains valid.

- `h_A_02_001` (matched inference beats aggregate means): **0.74**
  - Rationale: correct *if* the matching is real. Biggest uncertainty is verifying that “same 30 samples” are meaningfully comparable across experiments, especially in families that change bundling (`a6/a7`) or evidence view. Needs an explicit “matching validation gate” before using paired p-values/CIs as persuasive evidence.

- `h_A_03_001` (ranked tables -> hero visuals yields stable findings): **0.70**
  - Rationale: good discipline for exploration, but depends on building the right derived tables and keeping denominators consistent across families with different row counts.

- `h_A_04_001` (first report should prioritize `a6/a7`, `a1`, `a4`): **0.62**
  - Rationale: plausible based on current coarse summaries, but the TBM/closed-world conflict regime is currently near-saturated in many non-bundle families, which can distort “largest signal” comparisons. This should be reframed as “start there for discovery,” not “start there because effects are definitively strongest.”

## Step Scores

Below are likely next blueprint steps for “V3 data analysis -> comprehensive report.” These are scored on expected correctness and usefulness, given known risks.

- **S1: Validate matching assumptions (samples/evidence comparability across experiments).** **0.90**
  - Why: this is the single highest leverage gate; it de-risks every paired analysis.
  - Verification: for each `experiment_tag`, compute hashes of (a) evidence label sets per sample, (b) window ids per sample, and confirm they match within each intended contrast; quantify any mismatch.

- **S2: Add derived SQLite tables: `sample_metrics`, `evidence_metrics`, `family_pair_deltas`.** **0.85**
  - Why: converts “look at plots” into a reproducible mining surface.
  - Verification: row counts align with design (e.g., 30 samples per experiment; evidence count per experiment as expected), and can reproduce existing overview metrics when aggregated.

- **S3: Define a primary endpoint panel (small, prespecified) and secondary diagnostics.** **0.78**
  - Why: prevents metric cherry-picking; keeps report readable.
  - Risk: choosing endpoints prematurely can bias narrative; mitigate by labeling “pilot endpoints.”

- **S4: Per-family paired effect estimation with paired bootstrap CIs.** **0.80**
  - Why: robust default for pilot uncertainty.
  - Risk: if pairing is wrong, CIs are too tight; mitigated by S1.

- **S5: Paired permutation / sign-flip tests for a small subset of headline contrasts.** **0.72**
  - Why: good finite-sample check, but still rests on exchangeability.
  - Verification: consistent directionality with bootstrap; p-values treated as prioritization, not proof.

- **S6: Mixed-effects models (random intercepts for sample and evidence; simple fixed effects).** **0.66**
  - Why: useful for variance partitioning and covariate adjustments.
  - Risk: model misspecification and small-n brittleness; avoid random slopes early; interpret as descriptive partial pooling.

- **S7: Multiple comparison policy (BH-FDR for mining; Holm for limited confirmatory claims).** **0.68**
  - Why: useful discipline, but only if “family of tests” is defined clearly. Otherwise it creates a false sense of rigor.

- **S8: Distance maps (clustered heatmaps/MDS) for exploratory navigation only.** **0.60**
  - Why: can be helpful, but easy to overinterpret and sensitive to scaling/metric choice.
  - Verification: stability checks under alternative standardizations and distance definitions; otherwise mark as “exploratory map.”

- **S9: Driver decomposition (which evidence/bundles drive family effects).** **0.75**
  - Why: directly addresses confound risk called out in V2 (evidence distribution artifacts).
  - Risk: needs per-evidence tables and careful normalization for bundle families.

- **S10: Assemble a deterministic markdown report with embedded figures and links to CSV tables.** **0.86**
  - Why: low-risk and aligns with your workflow.
  - Verification: rerunnable from cache snapshot; every claim backed by a table/figure artifact.

## Lowest-Confidence Items (And Why)

- **Treating rubric quality as an adjustment covariate** (implicit in some narratives): may be post-treatment depending on estimand (rubric quality is influenced by model/config). This needs careful framing (stratify vs adjust) and should not be used to “correct” causal estimates without stating assumptions.

- **Using TBM/closed-world conflict as a primary endpoint**: currently appears to saturate near `1.0` outside bundle families under conjunctive fusion. It’s still usable as a regime/instability indicator, but needs sensitivity analyses (alternate aggregation; trimming; conflict filtering) and careful explanation.

- **Clustering/MDS “structure” claims**: easy to overinterpret; should be treated as discovery tooling only unless it remains stable under perturbations and is validated via matched deltas.

## Recommendation To Reduce Uncertainty Fastest

1. Implement S1 (matching validation) and S2 (derived tables).
2. Then do S4 (paired deltas + bootstrap) for `a1`, `a4`, and `a6/a7`.
3. Only after that, decide which belief/conflict summaries are stable enough to keep as headline metrics.

