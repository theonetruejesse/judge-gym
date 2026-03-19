# Certainty Report (v3-analysis-process)

Date: 2026-03-19

This certainty scoring is about the **process plan**, not about scientific conclusions in V3/V3.1. Scores reflect: grounding quality, feasibility, and likelihood the step reduces drift / improves report quality.

## Evidence Scores

- k_001_report_architecture_evidence: 0.82
  - Grounded in specific unreadable figure classes and existing curated figures; clear design implication (two-tier).
- k_002_statistical_exploration_evidence: 0.84
  - Strong: already aligns to what exists (matched sample deltas) and points to concrete missing derived tables.
- k_003_aggregation_alternatives_evidence: 0.78
  - Directionally strong, but depends on how pooling is defined (abstain handling, weights). Needs a required sensitivity panel.
- k_004_process_guardrails_evidence: 0.85
  - Strong: contract + manifests is a known-good strategy; risk is process overhead, mitigated by sandbox split.

## Hypothesis Scores

- h_A_01_001 (two-tier figure architecture): 0.80
  - High confidence this reduces churn and improves interpretability.
- h_A_02_001 (table-first mining > more plots): 0.78
  - True in practice; risk is missing nonlinear structure unless paired with a mandatory diagnostic plot set.
- h_A_03_001 (pooling primary, DST/TBM diagnostic): 0.72
  - Likely right given dependence/fan-in, but must remain a policy panel with sensitivity checks (not a doctrinal decision).
- h_A_04_001 (analysis contract + isolated lanes reduces drift): 0.83
  - Very likely. Main risk is slowing EDA; sandbox split mitigates.

## Step Scores (Blueprint)

- S0 Freeze analysis contract: 0.86
  - This is the highest leverage step; everything else depends on it.
- S1 Canonical derived tables: 0.82
  - Feasible and should immediately improve mining and multi-agent parallelism.
- S2 Figure triage ledger + repair transforms: 0.79
  - Feasible, but requires discipline. Biggest risk is scope creep (too many “repairs”).
- S3 Aggregation policy panel: 0.75
  - Useful, but easy to over-interpret. Treat as robustness/sensitivity section.
- S4 Deterministic spot checks: 0.78
  - High value; needs good “top-k” rules to avoid bias.
- S5 Report assembly: 0.81
  - Very feasible once inputs/tables/hero figures are stable.

## Lowest-Confidence Items (What To Watch)

- Aggregation policy becoming a bikeshed: keep it as a baseline + sensitivity section.
- Table-first mining missing visual heterogeneity: require a small diagnostic plot set rendered from ranked tables.
- Contract friction: split into frozen report pipeline vs exploratory sandbox, and version both.

