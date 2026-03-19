# Blueprint: V3 Analysis Contract + Subagent Execution Spec

This blueprint defines how we collaboratively explore and report V3/V3.1 results without drifting across data slices, plots, or aggregation choices. It is intentionally biased toward table-first mining and a strict separation between (1) exploratory analysis and (2) report-grade outputs.

## 0. What This Produces

1. A frozen **analysis contract** (inputs, inclusion/exclusion rules, canonical derived tables).
2. A parallelizable **subagent work plan** (stats/tables, figure triage/layout, aggregation methods, narrative).
3. A reproducible **execution pipeline** that generates:
   - canonical derived tables
   - ranked candidate findings
   - report-grade figure set
   - appendix figure set
   - a single assembled report markdown

This blueprint is planning-only. It does not dictate conclusions, only process and guardrails.

## 1. Evidence (What We Already Know)

Read these first; they ground the plan:

- Figure/readability constraints and need for a two-tier figure system:
  - `knowledge/k_001_report_architecture_evidence.md`
  - `knowledge/k_A01_001_figure_triage_evidence.md`
- Table-first mining and matched-sample inference as the core statistical unit:
  - `knowledge/k_002_statistical_exploration_evidence.md`
- DST/TBM fragility under dependent/fan-in sources; recommended aggregation stack:
  - `knowledge/k_003_aggregation_alternatives_evidence.md`
- Process drift is the main risk; a contract + manifests solve coordination:
  - `knowledge/k_004_process_guardrails_evidence.md`

Certainty scoring is recorded in `certainty/certainty_report.md`.

## 2. The Analysis Contract (Single Source of Truth)

The contract is a small file (recommend: YAML or JSON) that pins inputs and prohibits silent drift.

### 2.1 Contract Contents (Required)

- **Cache source of truth**
  - SQLite path: `packages/analysis/_cache/analysis.sqlite`
  - Required `export_schema_version` (currently schema `3`)
  - Explicit snapshot IDs (or exact experiment_tag + rule for selecting latest completed run)

- **Included experiments**
  - Explicit list of experiment tags, or a deterministic selector:
    - include: tags matching `^v3_` and `^v3_1_`
    - include only experiments whose *latest completed run* exists

- **Excluded experiments (scientific invalidity)**
  - explicit exclusions:
    - `v3_a6_gpt_4_1_bundle_5_l2`
    - `v3_a6_gpt_5_2_bundle_5_l2`
    - `v3_a7_gpt_4_1_bundle_5_l3`
    - `v3_a7_gpt_5_2_bundle_5_l3`
  - rationale: matching/bundling not controlled in that iteration

- **Canonical unit of analysis**
  - `sample_ordinal` within `experiment_tag`, optionally stratified by `bundle_signature`

- **Contrast registry**
  - explicit list of contrasts to treat as inferential (paired)
  - each contrast defines:
    - group A experiment tags
    - group B experiment tags
    - matching keys: sample_ordinal (+ bundle_signature when applicable)
    - primary endpoints to compute
    - whether the contrast is inferential or descriptive-only

- **Primary endpoints**
  - lock a short primary panel (others are secondary/diagnostic):
    - `abstain_rate`
    - `singleton_rate`
    - `mean_subset_size`
    - `expected_stage`
    - `mid_scale_mass`
    - `stage_entropy`

- **Multiplicity policy**
  - BH/FDR q-values over the primary endpoint panel for inferential contrasts

- **Spot-check policy**
  - top-k unstable samples
  - top-k largest effect contributors
  - deterministic selection rules and seed

### 2.2 Contract Contents (Recommended)

- **Figure promotion policy**
  - hero/report figures: small, readable at half-page
  - appendix figures: readable but not central
  - exploratory figures: allowed to be messy, never cited for main claims

- **Aggregation policy**
  - primary: geometry-first metrics
  - secondary: pooling baselines (linear + log)
  - diagnostic: DST/TBM and any belief-function variants (local, not global)

### 2.3 Contract Success Criteria

- Two different agents executing analysis on the same contract produce identical derived tables and figure manifests.
- Changing inclusion/exclusion requires an explicit contract revision (diff).

## 3. Subagent Responsibilities (Parallelizable)

Subagents must not refresh exports or change the contract. They work from the frozen cache and contract only.

### Role 1: Stats/Tables Agent

Deliverables:
- canonical derived tables (see Section 4)
- q-values for primary endpoints
- ranked candidate findings table
- top-k spot-check list (samples, bundles, contrasts)

Guardrails:
- no figure redesign
- no narrative writing

### Role 2: Figure Triage/Layout Agent

Deliverables:
- figure manifest with readability status:
  - report-grade / appendix / exploratory
- repair transforms for unreadable figures:
  - bucket verdict categories
  - remove per-cell annotations above thresholds
  - paginate facets
  - reorder axes
- final “hero set” list aligned to contrast registry

Guardrails:
- cannot invent new metrics
- cannot change statistical methods

### Role 3: Aggregation Methods Agent

Deliverables:
- sensitivity panel comparing:
  - geometry-only
  - linear pool
  - log pool
  - local DST/TBM diagnostics
- recommendation for what belongs in main text vs appendix

Guardrails:
- no new inferential claims; only robustness checks

### Role 4: Narrative/Report Agent

Deliverables:
- report outline
- integrates only report-grade figures and primary/secondary tables
- explicitly labels descriptive-only comparisons

Guardrails:
- cannot cite exploratory figures
- must cite table IDs / figure IDs from manifests

## 4. Canonical Derived Tables (Table-First Layer)

These are the tables we should generate every run before plotting:

### Required
- `contrast_registry.csv`
- `matching_validation.csv` (per contrast)
- `family_effects.csv` (paired deltas + bootstrap CI + sign-flip p)
- `family_effects_qvalues.csv` (BH/FDR over primary endpoints)
- `candidate_findings.csv` (ranked by effect size + stability)
- `sample_instability.csv` (cross-experiment variance / flip rate)
- `verdict_geometry_certainty.csv`
  - certainty conditioned on verdict geometry:
    - abstain, singleton, adjacent subset, non-adjacent subset, broad subset

### Recommended
- `effect_contribution_by_sample.csv`
- `bundle_policy_deltas.csv` (random vs cluster; l2 vs l3 projected; scale probes)
- `experiment_geometry.csv` (stage occupancy + compression/concentration indices)
- `experiment_metrics.csv` (one-row summary panel)

## 5. Figure Architecture (Hero vs Appendix vs Exploratory)

### 5.1 Hero Figure Set (Default)

Use the existing curated direction:
- `hero_contrast_heatmap`
- `hero_bundle_strategy_heatmap`
- `hero_scale_probe_profile`
- one evidence-group verdict distribution for `a1`
- one evidence-group belief heatmap for clustering family
- one “geometry vs certainty” figure (verdict geometry -> expert agreement)

### 5.2 Appendix Figures

- per-family verdict heatmaps
- per-family belief heatmaps
- rubric similarity dendrogram (if supporting a specific claim)

### 5.3 Exploratory Only

Any plot that violates readability thresholds:
- too many categories (verdict explosion at scale 9)
- per-cell annotations on large matrices
- sample-by-experiment heatmaps unless redesigned

## 6. Execution Sequence (How We Work Together)

### Phase 0: Freeze Inputs
1. Write contract file.
2. Validate contract against cache (snapshot IDs exist; excluded tags absent).

### Phase 1: Generate Canonical Tables
1. Compute derived tables (Section 4).
2. Run matching validation.
3. Produce q-values.
4. Emit ranked spot-check list.

### Phase 2: Render Figures From Ranked Tables
1. Render only hero figures + appendix set.
2. Repair any unreadable plot classes; update figure manifest.

### Phase 3: Spot Checks
1. Execute deterministic spot-checks (top-k unstable samples).
2. Record spot-check notes in a structured table (no freeform only).

### Phase 4: Assemble Report
1. Compose report markdown:
   - main findings: only inferential contrasts + hero figures
   - descriptive findings: clearly labeled + appendix figures
2. Include a “Robustness / Sensitivity” section for aggregation comparisons.

### Phase 5: Repro Gate
1. Re-run the full pipeline on the same contract and confirm identical outputs.
2. Only then “freeze” docs/pilots output.

## 7. Known Risks + Mitigations

- Risk: Over-contracting too early.
  - Mitigation: contract has a frozen “report pipeline” section and a free “exploratory sandbox” section.
- Risk: Aggregation misleads (DST conflict artifacts).
  - Mitigation: treat DST/TBM as diagnostic unless stable under pooling sensitivity.
- Risk: Multiple comparisons.
  - Mitigation: lock primary endpoints; compute q-values; separate exploratory from inferential.

## 8. Next Step (Immediate)

Write the analysis contract file and run the first full “tables-first” pass; do not touch plot redesign until the contract + canonical tables are stable.

