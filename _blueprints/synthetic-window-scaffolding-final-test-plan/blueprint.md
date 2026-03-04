# Blueprint: Synthetic Window Scaffolding Final Test Plan

> [One-paragraph summary of the project or research direction.]
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/synthetic-window-scaffolding-final-test-plan
- **Research Question:** Using low-sample synthetic setup in packages/engine, what remaining tests are required to validate window/run orchestration reliability before evidence flow rollout, and in what order should they be executed?
- **Scope:** [In-scope items]
- **Non-goals:** [Out of scope]
- **Constraints:** [Budget, time, tooling, risk limits]

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

- [List key evidence entries with short summaries]
- [Note critical gaps and missing evidence]

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | [Scope] | [Researcher] | [k_...] |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_01_001 | [Statement] | [k_...] | [0.0-1.0] |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_01_001 | Passed/Failed | [k_...] |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** [List with rationale]

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

### Step Template

- **Step ID / Name:** [e.g., S1: Initialize Data Model]
- **Objective:** [What this step achieves]
- **Evidence to Review:** [k_... entries or external citations]
- **Inputs:** [Files, configs, dependencies]
- **Actions:**
  1. [Concrete action]
  2. [Concrete action]
- **Outputs:** [New files, updated records]
- **Verification:** [Tests, checks, or acceptance criteria]
- **Risks/Assumptions:** [What could invalidate this step]
- **Confidence:** [0.0-1.0, from certainty scorer]

### Steps

#### S1: [Step Name]

- **Objective:** [Objective]
- **Evidence to Review:** [k_...]
- **Inputs:** [...]
- **Actions:**
  1. [...]
- **Outputs:** [...]
- **Verification:** [...]
- **Risks/Assumptions:** [...]
- **Confidence:** [...]

#### S2: [Step Name]

- **Objective:** [Objective]
- **Evidence to Review:** [k_...]
- **Inputs:** [...]
- **Actions:**
  1. [...]
- **Outputs:** [...]
- **Verification:** [...]
- **Risks/Assumptions:** [...]
- **Confidence:** [...]

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- [Open question]
- [Open question]

---

## Appendix: Sources

- [Citations or links]

