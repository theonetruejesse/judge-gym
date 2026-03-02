# Blueprint: Convex Dead Code + Boundary Cleanup

> Consolidate a grounded mental model of Convex function usage and boundaries, identify dead code, and propose a cleanup/refactor plan centered on the Lab ↔ Engine surface and orchestrator vs implementation separation.
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/convex-dead-code-boundaries
- **Research Question:** Assess Convex functions for dead code, boundary clarity between lab and engine, and orchestrator vs implementation separation. Propose cleanup/structure plan and mental model.
- **Scope:** Convex backend under `packages/engine/convex`, Lab usage under `packages/lab`, boundaries between Lab and Engine and orchestration layers.
- **Non-goals:** Implementing refactors or schema changes in this pass.
- **Constraints:** Use local repo evidence only; no external sources.

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

- **k_001:** Lab uses `api.packages.lab.*` via engine re-export, defining the current boundary surface. (`packages/lab/app/*`, `packages/engine/src/index.ts`)
- **k_002:** `getWindowSummary` is defined but not referenced by Lab or other modules.
- **k_003:** `listEvidenceWindows` performs per-window queries and the evidence page over-fetches window lists.
- **k_004:** LLM execution services resolve apply/error handlers and trigger requeue directly (boundary leak).
- **k_005:** Stage progression and requeue logic live in domain services, duplicating orchestrator logic.
- **k_006:** Multiple internal repo functions appear to be definition-only and unused.
- **k_007:** Several fields/tables are write-only or only used for counts, not full reads.
- **k_008:** Run status lifecycle appears partial; job/batch custom_key fields appear unused.
- **k_009:** Lab client validation is stricter than server-side validation for window forms.

Critical gaps:
- Whether any internal functions are called by scripts/notebooks outside the repo.
- Whether write-only tables/fields are intentional for future analytics.
- Full callable inventory/caller map is now materialized in `_blueprints/convex-dead-code-boundaries/convex_function_audit.tsv` and summarized in `_blueprints/convex-dead-code-boundaries/full_audit_report.md`.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Convex function inventory / dead code | Erdos | k_006, k_002 |
| A_02 | Lab ↔ Engine boundary usage | Godel | k_001, k_003, k_009 |
| A_03 | Orchestration vs implementation separation | Mencius | k_004, k_005 |
| A_04 | Schema/model alignment | Sagan | k_007, k_008 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A1_001 | Unused internal functions and `getWindowSummary` can be removed safely. | k_002, k_006 | 0.62 |
| h_A2_001 | Per-entity queries will reduce overfetch and N+1 cost. | k_003 | 0.58 |
| h_A3_001 | Move apply/requeue routing into orchestrator lifecycle module. | k_004 | 0.60 |
| h_A3_002 | Centralize stage progression in orchestrators. | k_005 | 0.57 |
| h_A4_001 | Remove or expose read paths for write-only fields/tables. | k_007 | 0.55 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A1_001 | Passed | Tests exist but no call sites found in repo (`packages/engine/convex/tests`). |
| h_A3_001 | Passed | `process_workflows` already centralizes lifecycle, reducing need for execution-layer routing. |
| h_A4_001 | Passed | Tests assert critic counts, suggesting some expectations around tables. |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviewed evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** h_A4_001 (future analytics unknown), k_008 (status lifecycle inference).

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria.

### Steps

#### S1: Build a Convex Call Graph + Dead-Code Map

- **Objective:** Establish authoritative reference map of Convex functions and call sites.
- **Evidence to Review:** k_001, k_002, k_006
- **Inputs:** `packages/engine/convex/**`, `packages/lab/**`
- **Actions:**
  1. Produce a function → callers map (including internal `runMutation`/`runQuery` references).
  2. Mark endpoints as `lab-entrypoint`, `internal-only`, or `unused`.
- **Outputs:** `docs/convex_call_graph.md` (or internal note), list of candidates for removal.
- **Verification:** No unresolved references in map; each `unused` candidate has zero call sites.
- **Risks/Assumptions:** External scripts may call internal functions.
- **Confidence:** 0.68

#### S2: Decide Prune vs. Wire-Up for Unused Functions

- **Objective:** Decide which unused functions to delete vs. to activate.
- **Evidence to Review:** k_002, k_006
- **Inputs:** Output of S1, team intent on future features.
- **Actions:**
  1. For each `unused` item, pick `remove`, `keep but document`, or `wire-up`.
  2. Create a deletion list and a “keep” list with justification.
- **Outputs:** Decision log + target removal list.
- **Verification:** Agreement with owners of Lab/Engine; no breaking changes.
- **Risks/Assumptions:** Some functions may be relied on in hidden workflows.
- **Confidence:** 0.61

#### S3: Define Clear Orchestration Boundaries

- **Objective:** Move lifecycle decisions to orchestration layer and make services pure.
- **Evidence to Review:** k_004, k_005
- **Inputs:** `llm_job_service.ts`, `llm_batch_service.ts`, `run_service.ts`, `window_service.ts`, `process_workflows.ts`
- **Actions:**
  1. Draft a “request lifecycle” module owned by orchestrator that applies results and decides retries.
  2. Identify service methods to convert into pure “apply” handlers (no requeue, no stage transitions).
  3. Move `maybeAdvance*` logic into orchestrators or a shared stage-progress helper.
- **Outputs:** Refactor plan and module diagram.
- **Verification:** Orchestrator tests can still pass with no duplicate logic.
- **Risks/Assumptions:** Requires multi-file refactor and careful ordering of side effects.
- **Confidence:** 0.61

#### S4: Fix Lab Overfetch and Add Targeted Queries

- **Objective:** Reduce N+1 queries and overfetch in Lab UI.
- **Evidence to Review:** k_003, k_002, k_001
- **Inputs:** `packages/engine/convex/packages/lab.ts`, Lab pages.
- **Actions:**
  1. Decide whether to use `getWindowSummary` or replace it with a smaller query.
  2. Update evidence detail page to fetch only required window data.
  3. Consider a `getExperimentById` query to avoid list-first selection.
- **Outputs:** Updated API surface proposal and UI query list.
- **Verification:** Lab pages render with fewer queries; no regressions.
- **Risks/Assumptions:** UI may depend on lists for navigation; must confirm.
- **Confidence:** 0.60

#### S5: Schema and Data Contract Cleanup

- **Objective:** Remove or expose read paths for write-only fields and align status lifecycle.
- **Evidence to Review:** k_007, k_008, k_009
- **Inputs:** `schema.ts`, model files, run/window services.
- **Actions:**
  1. Decide whether to retain or remove `assistant_reasoning`, tokens, and critic tables.
  2. If retaining, add read APIs for analytics/debugging.
  3. Align run status lifecycle with `StateStatusSchema` or simplify schema.
  4. Add server-side validation for window forms to match client constraints.
- **Outputs:** Schema-change plan and migration checklist.
- **Verification:** Updated schema passes typecheck and tests; data contract documented.
- **Risks/Assumptions:** Removing fields impacts data migrations and tests.
- **Confidence:** 0.57

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- Do any scripts or notebooks call the internal Convex functions marked “unused”?
- Do you want to preserve critic tables and LLM token fields for analytics, or prune now?
- Should Lab keep list-based pages, or can we safely move to per-entity queries?
- Should orchestration own all retry and stage progression decisions, or is a hybrid needed?

---

## Appendix: Sources

- Internal repo evidence files under `_blueprints/convex-dead-code-boundaries/knowledge/`
