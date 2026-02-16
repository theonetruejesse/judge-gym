# Blueprint: Simplify Engine Config/Run Model

> Simplify judge-gym’s engine architecture so experiments/windows define the study, runs define execution knobs (counts), and evidence consistency is preserved across runs while retaining run policy snapshots for reproducibility.
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/judge-gym/_blueprints/simplify
- **Research Question:** Simplify judge-gym engine architecture to align with desired workflow: experiments/windows configs separate from engine; counts (sample_count, evidence_cap) defined per run; ensure evidence consistency across runs; reduce overengineering while preserving policy snapshots and reproducibility.
- **Scope:** Engine data model, run/experiment entrypoints, evidence binding, scoring workflows, UI/README alignment, and minimal migration path.
- **Non-goals:** Full removal of templates/run_configs unless explicitly chosen; redesign of scheduler or LLM batching; changes to evidence collection logic beyond count handling.
- **Constraints:** Do not implement code in this phase; preserve evidence freeze semantics and run policy snapshots; keep reproducibility traceable.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` is the registry for subagent assignments, evidence, and synthesis status.

- **Agent Registry:** lead, researchers, falsifier, certainty scorer, synthesizer
- **Assignments:** list of Areas of Analysis and assigned subagents
- **Evidence Registry:** `knowledge/k_..._evidence.md`
- **Hypotheses Registry:** `hypotheses/hyp_...json`
- **Null Challenges:** `null_challenges/nc_...json`
- **Certainty Report:** `certainty/certainty_report.md`

---

## 2. Evidence Ledger (Grounding)

- `k_001_evidence`: Counts live in `scoring_stage` config and directly govern binding/scoring.
- `k_002_evidence`: Evidence is frozen by `bindExperimentEvidence`, with `evidence_cap` slicing.
- `k_003_evidence`: Runs snapshot policy and config via `run_config_id`.
- `k_004_evidence`: Templates/experiments/spec signatures are tightly coupled.
- `k_005_evidence`: Run summaries recompute counts from samples/scores.
- `k_006_evidence`: Lab UI expects counts on experiment config.
- `k_007_evidence`: README documents counts as experiment config axes.

**Critical gaps:** No explicit run-level counts exist today; need to verify if any external tooling depends on `config_template_id/version` or spec signature stability beyond the codebase.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A1_Current_Model | Current data model + flow, where counts are used | 019c63db-57f9-7e32-8bca-ef05f497529d | k_001, k_002, k_003 |
| A2_Simplified_Model | Simplified target model (counts on runs) | 019c63db-5807-7323-a09d-4ccc17d650a7 | k_001, k_003, k_004 |
| A3_Evidence_Policy | Evidence freeze and policy snapshots | 019c63db-5823-74d1-837f-5f244eba06e5 | k_002, k_003, k_005 |
| A4_Migration_Surface | Migration + UI/docs/tests impact | 019c63db-584a-7793-b8f9-2a44095cdc42 | k_004, k_006, k_007 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A1_001 | Counts are embedded in experiment config and directly govern binding/scoring. | k_001, k_002 | 0.72 |
| h_A2_001 | Moving counts to runs reduces template churn while preserving reproducibility via run snapshots. | k_003, k_004 | 0.66 |
| h_A3_001 | Evidence consistency can be preserved by keeping experiment-level binding and applying run-level caps. | k_002, k_003 | 0.62 |
| h_A4_001 | Minimal migration is feasible by adding run-level counts with fallback to experiment counts. | k_004, k_006, k_007 | 0.64 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A1_001 | Passed | — |
| h_A2_001 | Failed | `packages/engine/convex/utils/spec_signature.ts`, `packages/lab/app/editor/experiment/page.tsx` |
| h_A3_001 | Passed | — |
| h_A4_001 | Failed | `packages/engine/convex/utils/spec_signature.ts`, `packages/lab/app/editor/experiment/page.tsx` |

**Implication:** A clean move of counts to run-level requires explicitly reworking spec signatures and UI/README contracts, not just adding run fields.

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** [Pending certainty report]

---

## 7. Prebuilt Implementation Plan

Each step cites evidence, specifies outputs, and includes verification criteria. This plan is intended to be executed without re-deriving decisions.

### Steps

#### S1: Enumerate and Confirm Contract Surface for Counts

- **Objective:** Produce a definitive list of code/UI/docs that treat counts as experiment-level to avoid silent regressions.
- **Evidence to Review:** k_001, k_006, k_007
- **Inputs:** `packages/engine/convex/models/core.ts`, `packages/engine/convex/domain/experiments/*`, `packages/lab/app/*`, `README.md`
- **Actions:**
  1. Enumerate all reads/writes of `sample_count` and `evidence_cap` across engine, UI, docs, and tests.
  2. Categorize each usage as schema, runtime behavior, or display-only.
- **Outputs:** A checklist of impacted files with a “must update” classification.
- **Verification:** No remaining references to counts outside the checklist (rg search clean).
- **Risks/Assumptions:** Assumes no external tooling depends on counts in experiment config.
- **Confidence:** Pending

#### S2: Decide the New Source of Truth and Adjust Spec Signatures

- **Objective:** Move counts off experiment config while keeping experiment identity stable and reproducible.
- **Evidence to Review:** k_003, k_004, k_007
- **Inputs:** `packages/engine/convex/utils/spec_signature.ts`, `packages/engine/convex/models/core.ts`, `packages/engine/convex/models/configs.ts`
- **Actions:**
  1. Define a `RunCounts` schema (e.g., `{ sample_count, evidence_cap }`) to attach to runs or run_configs.
  2. Remove counts from `ScoringStageConfig` or mark them optional; update `ExperimentConfig` accordingly.
  3. Update `buildExperimentSpecSignature` to exclude counts so experiment identity no longer changes with run-level counts.
- **Outputs:** Updated schema definitions and spec-signature rules.
- **Verification:** Existing experiment templates with different counts produce identical `spec_signature` when all other fields match.
- **Risks/Assumptions:** Requires coordinated UI/doc updates to avoid confusing users about where counts live.
- **Confidence:** Pending

#### S3: Store Run-Level Counts at Run Creation

- **Objective:** Persist run-level counts alongside the run so execution uses the intended knobs.
- **Evidence to Review:** k_003, k_004
- **Inputs:** `packages/engine/convex/domain/runs/runs_entrypoints.ts`, `packages/engine/convex/domain/configs/configs_repo.ts`, `packages/engine/convex/models/runs.ts`
- **Actions:**
  1. Extend `startExperiment` (and related entrypoints) to accept `run_counts` parameters.
  2. Persist `run_counts` either on the run row or inside `run_configs` (recommended if keeping run configs).
  3. Default to previous experiment-level counts during transition, but log which source was used.
- **Outputs:** Runs have explicit counts; run_configs capture run-specific knobs for reproducibility.
- **Verification:** Starting a run with different counts produces distinct run metadata without changing experiment identity.
- **Risks/Assumptions:** Dual-source defaults could cause ambiguity unless clearly surfaced in UI/logs.
- **Confidence:** Pending

#### S4: Update Evidence Binding and Scoring to Use Run Counts

- **Objective:** Ensure execution uses run-level counts while preserving evidence freeze semantics.
- **Evidence to Review:** k_001, k_002, k_003
- **Inputs:** `packages/engine/convex/domain/experiments/experiments_entrypoints.ts`, `packages/engine/convex/domain/experiments/stages/scoring/workflows/experiments_scoring_seed_requests.ts`
- **Actions:**
  1. Update `bindExperimentEvidence` to read `evidence_cap` from the active run (or supplied run_id) instead of experiment config.
  2. Update scoring seed to read `sample_count` from the run config rather than experiment config.
  3. Keep evidence binding experiment-scoped to preserve “frozen” evidence across runs; if run caps differ, validate against the bound set.
- **Outputs:** Scoring uses run-level counts; evidence freeze still enforced.
- **Verification:** Attempts to score without binding still fail; changing run counts changes number of samples/scores without altering evidence set.
- **Risks/Assumptions:** Requires clarity about whether different runs may use different evidence caps against the same bound set.
- **Confidence:** Pending

#### S5: Update Summary Surfaces, UI, and Docs

- **Objective:** Reflect run-level counts in the UI and docs without confusing experiment identity.
- **Evidence to Review:** k_005, k_006, k_007
- **Inputs:** `packages/engine/convex/domain/experiments/experiments_data.ts`, `packages/lab/app/*`, `README.md`
- **Actions:**
  1. Update run summary to surface run-level counts (and keep aggregations for actual results).
  2. Update Lab UI to collect and display run counts at run-start, not in experiment config editor.
  3. Rewrite README “Design Space” and CLI examples to show counts as run parameters.
- **Outputs:** UI/README aligned with new model.
- **Verification:** UI shows counts per run; docs show correct CLI payloads.
- **Risks/Assumptions:** UI changes may require UX decisions on default counts.
- **Confidence:** Pending

#### S6: Migration, Backward Compatibility, and Tests

- **Objective:** Keep existing experiments/templates working while shifting counts to run-level.
- **Evidence to Review:** k_004, k_006, k_007
- **Inputs:** `packages/engine/tests/*`, `packages/engine/convex/models/*`, `packages/engine/convex/domain/*`
- **Actions:**
  1. Implement a temporary fallback: if run counts are missing, read from experiment config and log a warning.
  2. Update tests and fixtures to pass run counts explicitly.
  3. Provide a short migration note or script to re-seed templates if needed.
- **Outputs:** Passing tests and a clear migration path.
- **Verification:** Tests pass with run-level counts; no runtime references to experiment-level counts remain in hot paths.
- **Risks/Assumptions:** Dual-source counts can cause confusion if not sunset promptly.
- **Confidence:** Pending

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- Should counts live on `runs` or `run_configs` (or both), and which should be authoritative in summaries?
- Do we want to keep config templates/run_configs at all, or is a single experiment config store sufficient?
- If different runs use different `evidence_cap`, should evidence binding be per run instead of per experiment?

---

## Appendix: Sources

- `knowledge/k_001_evidence.md`
- `knowledge/k_002_evidence.md`
- `knowledge/k_003_evidence.md`
- `knowledge/k_004_evidence.md`
- `knowledge/k_005_evidence.md`
- `knowledge/k_006_evidence.md`
- `knowledge/k_007_evidence.md`
