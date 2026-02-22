# Blueprint: Lab Integration (Evidence Flow + Smoke Tests)

> Define the minimal Convex lab facade and smoke-test path needed to run end-to-end evidence-window flows and integrate the existing lab UI evidence screens from the refactor-everything branch.
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** `_blueprints/integration`
- **Research Question:** Define minimal lab.ts public endpoints and smoke tests for window evidence flow, based on refactor-everything lab UI wiring, to enable end-to-end manual testing.
- **Scope:** Evidence window creation/collection, evidence listing/content UI, smoke tests for window flow
- **Non-goals:** Full experiment/runs lifecycle; env preflight enforcement
- **Constraints:** Use `packages/engine/convex/packages/lab.ts` as the public API surface; assume env keys are set for now

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

- `k_001`: Refactor-everything window editor calls `api.lab.initEvidenceWindowAndCollect`. (packages/lab/app/editor/window/page.tsx)
- `k_002`: Lab home page uses `api.lab.listEvidenceWindows`. (packages/lab/app/page.tsx)
- `k_003`: Evidence detail page uses `api.lab.listEvidenceByWindow` and `api.lab.getEvidenceContent`. (packages/lab/app/evidence/[id]/page.tsx)
- `k_004`: Refactor-everything `convex/lab.ts` exposes evidence endpoints. (packages/engine/convex/lab.ts)
- `k_005`: Integration tests use `api.lab` facade for evidence + experiment flows. (packages/engine/tests/integration_lab_facade.test.ts)
- `k_006`: Current branch has window flow primitives (`startWindowFlow`, `insertEvidenceBatch`) but `packages/engine/convex/packages/lab.ts` is empty. (window_service.ts, window_repo.ts, packages/lab.ts)

Critical gaps:
- No public lab facade in current branch for evidence endpoints.
- No smoke tests aligned with the new evidence-only window flow.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Refactor-everything lab UI evidence flow | 019c878a-babf-7ca0-ad0e-dc562abeaa32 | k_001, k_002, k_003 |
| A_02 | Refactor-everything lab facade + tests | 019c878a-c618-7022-848c-4610fd6e2dab | k_004, k_005 |
| A_03 | Current branch window flow primitives | 019c878a-d151-7420-9b9b-72da8af0dbf6 | k_006 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_01_001 | Minimal lab facade should expose evidence endpoints aligned with the refactor-everything UI. | k_001–k_004 | 0.64 |
| h_A_02_001 | Smoke tests should validate window flow completion (l1→l3 outputs) via lab facade endpoints. | k_005, k_006 | 0.60 |
| h_A_03_001 | Evidence-only endpoints may be sufficient for initial integration. | k_001–k_003 | 0.55 (challenged) |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_03_001 | Failed | Lab home page + integration tests also use experiment endpoints (packages/lab/app/page.tsx, packages/engine/tests/integration_lab_facade.test.ts) |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** TBD by certainty scorer.

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

### Steps

#### S1: Implement Evidence-Focused Lab Facade (`packages/engine/convex/packages/lab.ts`)

- **Objective:** Create the minimal public API for the evidence UI and smoke tests.
- **Evidence to Review:** k_001–k_004, k_006
- **Inputs:** `packages/engine/convex/packages/lab.ts`, `packages/engine/convex/domain/window/window_service.ts`, `packages/engine/convex/domain/window/window_repo.ts`
- **Actions:**
  1. Expose `initEvidenceWindowAndCollect`-equivalent endpoint that takes a window spec and calls `createWindow` + `startWindowFlow` (or add a small reuse check).
  2. Add `listEvidenceWindows` query: join `windows` with evidence counts and stage status for UI rows.
  3. Add `listEvidenceByWindow` query: returns evidence list rows (id/title/url/created_at).
  4. Add `getEvidenceContent` query: returns raw + cleaned + neutralized + abstracted fields.
  5. Optionally expose `insertEvidenceBatch` for manual smoke tests.
- **Outputs:** Evidence-only lab endpoints matching the refactor-everything UI calls.
- **Verification:** `packages/lab` UI compiles and fetches data from `api.lab.*` endpoints.
- **Risks/Assumptions:** Window reuse semantics may differ from the old UI; evidence counts/status need explicit definitions.
- **Confidence:** 0.60

#### S2: Port Evidence UI Screens (Window Editor + Evidence Detail)

- **Objective:** Keep only evidence-focused UI from the refactor-everything lab UI.
- **Evidence to Review:** k_001–k_003
- **Inputs:** `packages/lab/app/editor/window/page.tsx`, `packages/lab/app/evidence/[id]/page.tsx`, styling components
- **Actions:**
  1. Port evidence window editor (Create Window & Collect) using the new `api.lab.initEvidenceWindowAndCollect` endpoint.
  2. Port evidence list/detail view using `listEvidenceWindows`, `listEvidenceByWindow`, `getEvidenceContent`.
  3. Remove or hide experiment sections if they are not yet supported.
- **Outputs:** Evidence-only lab UI screens with existing styling.
- **Verification:** Manual UI flow: create window → see in evidence list → view evidence content tabs.
- **Risks/Assumptions:** If you keep the existing home page, experiment sections must be removed or stubbed to avoid missing endpoints.
- **Confidence:** 0.55

#### S3: Add Evidence-Only Smoke Tests

- **Objective:** Provide deterministic smoke tests for the window flow.
- **Evidence to Review:** k_005, k_006
- **Inputs:** new test file in `packages/engine/tests/`, lab endpoints
- **Actions:**
  1. Create a window (lab endpoint), insert synthetic evidence (lab `insertEvidenceBatch`).
  2. Start orchestration (`startWindowOrchestration` or `startWindowFlow`).
  3. Poll evidence rows until `l1/l2/l3` fields are populated or a timeout is reached.
  4. Assert `windows.status` becomes `completed` when the final stage finishes.
- **Outputs:** A smoke test that validates end-to-end window processing when env keys are set.
- **Verification:** Test passes when env keys are present; skips otherwise.
- **Risks/Assumptions:** Depends on provider latency; polling may need generous timeouts.
- **Confidence:** 0.52

#### S4: Optional: Minimal Experiment Endpoint Stubs (If Keeping Home Page)

- **Objective:** Avoid UI breakage if the home page still renders experiments.
- **Evidence to Review:** k_002, k_005
- **Inputs:** `packages/engine/convex/packages/lab.ts`, UI routes
- **Actions:**
  1. Either remove experiment sections from the UI or add stub endpoints that return empty lists.
  2. Ensure UI doesn’t throw if experiments are missing.
- **Outputs:** Stable UI even if only evidence endpoints are active.
- **Verification:** Home page renders without runtime errors.
- **Risks/Assumptions:** Stubbing may create tech debt if not removed later.
- **Confidence:** 0.45

#### S5: Document the Evidence Flow + Smoke Path

- **Objective:** Update docs to reflect new lab facade and test flow.
- **Evidence to Review:** k_006
- **Inputs:** `README.md` or `packages/engine/convex/README.md`
- **Actions:**
  1. Document the lab endpoints used for evidence flow.
  2. Add a short “smoke test” section (env assumptions, command to run tests).
- **Outputs:** Clear docs for manual and automated verification.
- **Verification:** Docs match actual endpoints and test names.
- **Risks/Assumptions:** Requires keeping docs up to date as endpoints evolve.
- **Confidence:** 0.50

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** Evidence-only UI path acknowledged as dependent on trimming experiment sections or stubbing endpoints.
4. **Verification Gate:** Each step has a checkable outcome.

---

## 9. Open Questions

- Should `initEvidenceWindowAndCollect` implement reuse logic, or always create new windows?
- Do we want evidence status indicators (scraping/cleaning/neutralizing/abstracting/ready), and how should they be computed?
- Should smoke tests rely on real provider calls, or mock/stub LLM providers?

---

## Appendix: Sources

- refactor-everything:packages/lab/app/editor/window/page.tsx
- refactor-everything:packages/lab/app/page.tsx
- refactor-everything:packages/lab/app/evidence/[id]/page.tsx
- refactor-everything:packages/engine/convex/lab.ts
- refactor-everything:packages/engine/tests/integration_lab_facade.test.ts
- packages/engine/convex/packages/lab.ts
- packages/engine/convex/domain/window/window_service.ts
- packages/engine/convex/domain/window/window_repo.ts
