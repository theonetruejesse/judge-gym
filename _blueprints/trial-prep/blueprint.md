# Blueprint: trial-prep

> Prepare and execute the first MVP end-to-end trial run with `gpt-4.1` for rubric + scoring, fixed evidence window `2026-01-01..2026-01-07`, target `10`, and L2 tone neutralization (`evidence_view=neutralized`).
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/judge-gym/_blueprints/trial-prep
- **Research Question:** Prep for first MVP end-to-end trial run using gpt-4.1 for rubric/scorer, evidence fixed window 2026-01-01 to 2026-01-07, target 10, l2 semantic cleanup (tone neutralization). Assess current system readiness, remaining cleanup surfaces (lab/TUI, configs, schema), and plan steps to run experiment.
- **Scope:** MVP trial prep, including environment readiness, TUI/CLI execution path, trial config, evidence ingestion + neutralization, run execution, and output validation.
- **Non-goals:** Full automation of evidence cleaning/neutralization workflows; long-term product UX improvements beyond minimal MVP TUI cleanup.
- **Constraints:** No migrations needed (tables empty). Engine dev server assumed running. Use existing Convex/LLM infrastructure.

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

- **k_001:** Manual CLI workflow for initExperiment → createRun → queue rubric/scoring + export. (README)
- **k_002:** ExperimentConfigSchema required fields + evidence_view enum. (core.ts)
- **k_003:** Scoring seed requires parsed rubric, evidence presence, and uses sample_count/evidence_limit. (seed_requests.ts)
- **k_004:** insertEvidenceBatch accepts neutralized_content for manual ingestion. (entrypoints.ts)
- **k_005:** Evidence workflows directory is empty (no automated neutralization). (stages/evidence)
- **k_006:** Lab TUI bootstraps only via env flags and uses static EXPERIMENT_SETTINGS. (lab)
- **k_007:** OpenAI batch adapter requires OPENAI_API_KEY. (openai_batch.ts)
- **k_008:** Lab supervisor loop submits/polls batches; without it, queued requests stay queued. (lab)
- **k_009:** Scoring prompts fall back to raw_content when configured view missing. (scoring_prompts.ts)

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Experiment pipeline readiness (schema, workflows, CLI flow). | 019c58fe-b5ca-7f23-a59b-e042099d603c | k_001, k_002, k_003, k_008 |
| A_02 | Lab/TUI readiness and UX gaps for MVP run creation and monitoring. | 019c58fe-b5d4-74e3-8022-8348111cbba2 | k_006, k_008 |
| A_03 | Evidence acquisition + cleanup pipeline (neutralization) readiness. | 019c58fe-b5eb-7f11-9dfb-44ff115ccd3e | k_004, k_005, k_009 |
| A_04 | Ops/testing readiness, env requirements, runbook docs. | 019c58fe-b60b-7e62-8ef1-3831f7600c88 | k_001, k_007, k_008 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A1_001 | End-to-end run is executable today via manual CLI flow, provided evidence exists and rubric parses. | k_001, k_003, k_008 | 0.62 |
| h_A2_001 | Lab TUI is insufficient for clean MVP operator flow due to hidden env flags + hard-coded settings. | k_006 | 0.66 |
| h_A3_001 | Neutralization is not automated; neutralized_content must be supplied manually or workflows built. | k_004, k_005, k_009 | 0.48 |
| h_A4_001 | gpt-4.1 runs require OPENAI_API_KEY; missing keys block batch submission. | k_007 | 0.65 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A1_001 | Failed | k_008 (supervisor loop required for batch submission) |
| h_A2_001 | Passed | k_006 |
| h_A3_001 | Passed | k_009 (fallback to raw, neutralization not required to run) |
| h_A4_001 | Passed | k_007 |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviewed evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** S2 (TUI cleanup scope), S4 (manual neutralization effort), h_A3_001 (neutralization not required to run but required for L2 semantics).

---

## 7. Prebuilt Implementation Plan

Each step cites evidence, specifies outputs, and includes verification criteria. This plan is intended to be executed without re-deriving decisions.

### Steps

#### S1: Confirm Environment + Providers

- **Objective:** Ensure Convex + OpenAI credentials are ready to run `gpt-4.1` jobs.
- **Evidence to Review:** k_001, k_007, k_008
- **Inputs:** `.env`/`.env.local`, Convex URL, OpenAI API key.
- **Actions:**
  1. Verify `OPENAI_API_KEY` is present in the Convex runtime environment.
  2. Confirm the Lab supervisor loop can query/submit/poll batches (run `bun run lab` if using the TUI for supervision).
- **Outputs:** Valid credentials and an operational supervisor loop.
- **Verification:** Lab queries succeed and batch submissions do not error on missing keys.
- **Risks/Assumptions:** Missing keys or no supervisor loop will leave requests queued.
- **Confidence:** 0.60

#### S2: Decide Orchestration Path + TUI Cleanup (MVP)

- **Objective:** Establish a clean operator flow for the MVP run.
- **Evidence to Review:** k_006, k_008
- **Inputs:** Lab TUI source (`packages/lab`), desired UX bar for MVP.
- **Actions:**
  1. Decide whether MVP uses CLI-only run creation + TUI-only supervision, or whether TUI must handle run creation.
  2. If TUI must handle run creation, implement minimal cleanup: expose a visible run bootstrap control, surface current experiment settings, and render stage-level queue stats.
- **Outputs:** A clear runbook and usable TUI/CLI flow.
- **Verification:** An operator can create a run without hidden env flags or code edits, and can see stage/queue status.
- **Risks/Assumptions:** Scope creep if TUI UX requirements expand; CLI-only may be acceptable short-term.
- **Confidence:** 0.55

#### S3: Set Trial Config (gpt-4.1, Window, Target 10, L2)

- **Objective:** Define the trial parameters consistently across lab or CLI.
- **Evidence to Review:** k_001, k_002, k_006
- **Inputs:** Desired trial spec: window `2026-01-01..2026-01-07`, `gpt-4.1` for rubric/scoring, `evidence_view=neutralized`, `sample_count=10`, `evidence_limit=10`.
- **Actions:**
  1. If using Lab settings, update `packages/lab/src/experiments.ts` to `gpt-4.1` and set `sample_count/evidence_limit` to `10`.
  2. If using CLI, pass the same fields via `initExperiment` and `queueScoreGeneration`.
- **Outputs:** Experiment config stored in Convex.
- **Verification:** `initExperiment` succeeds; config fields match spec.
- **Risks/Assumptions:** Model availability and quotas; config mismatch across lab/CLI.
- **Confidence:** 0.70

#### S4: Ingest Evidence + L2 Neutralization

- **Objective:** Ensure evidence exists for the window and includes neutralized content.
- **Evidence to Review:** k_004, k_005, k_009
- **Inputs:** Evidence list (10 items) for `2026-01-01..2026-01-07`.
- **Actions:**
  1. Produce `neutralized_content` for each evidence item (manual for MVP).
  2. Insert evidence via `insertEvidenceBatch` with raw + neutralized fields.
- **Outputs:** Evidence rows with non-empty `neutralized_content`.
- **Verification:** Evidence count >= 10 for window; neutralized field populated for each row.
- **Risks/Assumptions:** No automated neutralization; scoring will fall back to raw if neutralized is missing, which violates L2 requirements.
- **Confidence:** 0.55

#### S5: Execute Rubric + Scoring Pipeline

- **Objective:** Run rubric generation and scoring for target `10`.
- **Evidence to Review:** k_001, k_003, k_008, k_007
- **Inputs:** Experiment tag, evidence rows, running supervisor.
- **Actions:**
  1. Create a run and queue rubric generation.
  2. Keep supervisor loop running to submit/poll batches.
  3. After rubric parses, queue scoring with `sample_count=10` and `evidence_limit=10`.
- **Outputs:** Completed rubric and scoring outputs.
- **Verification:** `rubric.parse_status === parsed`; `samples_created == 10`; score requests complete.
- **Risks/Assumptions:** Missing evidence or rubric parse failures block scoring; missing OpenAI key blocks batch submission.
- **Confidence:** 0.58

#### S6: Validate Outputs + Export Bundle

- **Objective:** Confirm experiment outputs and export for analysis.
- **Evidence to Review:** k_001, k_009
- **Inputs:** Experiment tag.
- **Actions:**
  1. Run `getExperimentSummary` and `exportExperimentBundle`.
  2. Validate that evidence view used neutralized content (spot-check prompts or data outputs).
- **Outputs:** Exported bundle and validated summary.
- **Verification:** Summary shows expected counts; bundle contains scores + evidence + rubric.
- **Risks/Assumptions:** If neutralized content is missing, scoring may reflect raw evidence.
- **Confidence:** 0.62

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Evidence rows exist for window with `neutralized_content` populated.
2. **Conflict Gate:** Hypothesis h_A1_001 revised to account for supervisor dependency.
3. **Null Challenge Gate:** All hypotheses have been challenged; one failed (h_A1_001), others passed.
4. **Verification Gate:** Each step has a checkable outcome.

---

## 9. Open Questions

- Should MVP accept raw evidence (no neutralization) if tone neutralization is too costly to do manually?
- Do we want to invest in minimal TUI run creation controls now, or accept CLI-only run creation for MVP?
- What evidence source and formatting rules will we standardize for the 10-item window?

---

## Appendix: Sources

- k_001..k_009 (see knowledge entries)
