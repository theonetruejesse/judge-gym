# Blueprint: readme-overhaul

> Align the root README with the refactored judge-gym architecture: highlight the domain/platform split, idempotent LLM ledger, policy enforcement and infra synchronization, and the single public API surface. Add high-level diagram slots to make the system easier to understand.
>
> This is a prebuilt implementation plan. Each step cites evidence and includes verification criteria.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/judge-gym/_blueprints/readme-overhaul
- **Research Question:** Bring README in sync with upgraded judge-gym architecture: emphasize idempotency guarantees, infra synchronization, and major design choices while adding architectural diagrams; treat the final-state doc as baseline.
- **Scope:** Update `README.md` to reflect the current domain/platform structure, LLM request ledger semantics, run policy enforcement, public API surface, and diagram placement.
- **Non-goals:** No code or schema changes; no changes outside the README unless explicitly approved later.
- **Constraints:** Use evidence under `knowledge/`. Avoid overpromising idempotency where request_version caveats apply.

---

## 1. Worldview Register (Single Source of Truth)

- **Lead / Synthesizer:** `codex`
- **Researchers:** A1–A4 (see `worldview.json`)
- **Falsifier:** `019c564a-39d2-7663-83d7-f03911aa72a0`
- **Certainty Scorer:** `019c564a-433b-7891-a9d8-9296d12268b7`
- **Evidence Registry:** `knowledge/k_001…k_006`
- **Hypotheses Registry:** `hypotheses/hyp_A1…hyp_A5`
- **Null Challenges:** `null_challenges/nc_h_A1_001.json` … `nc_h_A5_001.json`
- **Certainty Report:** `certainty/certainty_report.md`

---

## 2. Evidence Ledger (Grounding)

- `k_001_final_state_architecture.md`: Internal memo describing ledger-first batching, policy-driven orchestration, domain/platform split, stage locality, and engine export surface.
- `k_002_current_readme.md`: Current README still describes pre-refactor Convex layout and public API entrypoints, establishing the drift.
- `k_003_domain_platform_layout.md`: Live code references confirming domain entrypoints, stage-local workflows, and platform provider adapters.
- `k_004_idempotent_llm_requests.md`: Schema + request helpers demonstrate identity-based de-duplication via `getOrCreate` and the `by_identity` index.
- `k_005_policy_batching_rate_limit.md`: RunPolicy schema + batch lifecycle workflows + Lab supervisor show policy enforcement and rate limiting across queue/submit/poll/finalize.
- `k_006_public_api_integration.md`: Engine exports in `packages/engine/src/index.ts` plus Lab/Analysis consumers that depend on that surface.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned | Evidence IDs |
| --- | --- | --- | --- |
| A1 | Refactored Architecture Layout | A1_researcher | k_001, k_003 |
| A2 | Idempotency + Ledger Guarantees | A2_researcher | k_004 |
| A3 | Infra Synchronization + Policy Enforcement | A3_researcher | k_005 |
| A4 | Public API + Integration Points | A4_researcher | k_006 |
| A5 | README Structure + Diagrams | Lead | k_001, k_002, k_003 |

---

## 4. Hypotheses + Null Challenges (Summary)

- **h_A1_001 (layout mapping):** Passed. README currently documents the old layout and needs a new domain/platform mapping. See `nc_h_A1_001.json`.
- **h_A2_001 (idempotency):** Passed with caveat. Idempotency holds under the identity tuple, but `request_version` must be bumped when prompts change. See `nc_h_A2_001.json`.
- **h_A3_001 (policy sync):** Passed with caveat. Lab policy is a local constant; README should note manual sync with server run policy. See `nc_h_A3_001.json`.
- **h_A4_001 (public API):** Passed. README still references old entrypoints; must point to `packages/engine/src/index.ts`. See `nc_h_A4_001.json`.
- **h_A5_001 (diagrams):** Passed with maintenance caution. Existing blueprint diagrams may drift, so README diagrams must be high-level or linked. See `nc_h_A5_001.json`.

---

## 5. Implementation Plan (Steps)

### S1: Document the Domain/Platform Layout
- **Objective:** Replace the outdated monorepo structure section with the refactored layout and responsibilities.
- **Evidence to Review:** `k_001_final_state_architecture.md`, `k_003_domain_platform_layout.md`, `k_002_current_readme.md`.
- **Actions:**
  1. Update the README’s architecture section to show `packages/engine/convex/domain/{experiments,runs,llm_calls}` and `packages/engine/convex/platform/{providers,rate_limiter,utils}`.
  2. Note that stage-local prompts/parsers/workflows live under `domain/experiments/stages/*`.
- **Outputs:** Updated README structure diagram or list that mirrors the actual layout.
- **Verification:** Confirm every listed folder exists in the repo and matches the responsibilities described.
- **Risks/Assumptions:** Avoid listing every file; keep the section stable across minor refactors.
- **Confidence:** 0.78

### S2: Highlight the Idempotent LLM Request Ledger
- **Objective:** Explain the identity-based ledger and the idempotency guarantee.
- **Evidence to Review:** `k_004_idempotent_llm_requests.md`.
- **Actions:**
  1. Add a short “Idempotency Guarantees” subsection describing the identity tuple (`stage`, `provider`, `model`, `experiment_id`, `rubric_id`, `sample_id`, `evidence_id`, `request_version`).
  2. Add a caveat that new request versions must be explicitly bumped when prompts or logic change.
- **Outputs:** README section that explains why retries don’t duplicate requests and how to force a new request.
- **Verification:** Verify the identity index and `getOrCreate` helper still exist and match the README description.
- **Risks/Assumptions:** Do not overstate guarantees beyond the identity tuple; include the request_version caveat.
- **Confidence:** 0.82

### S3: Explain Run Policy Enforcement and Lab Sync
- **Objective:** Clarify server-side policy enforcement and how the Lab supervisor aligns with it.
- **Evidence to Review:** `k_005_policy_batching_rate_limit.md`.
- **Actions:**
  1. Add a section describing RunPolicy as the authoritative server-side contract (queue/submit/poll/finalize enforcement).
  2. Note that Lab uses `RUN_POLICY` for local scheduling but must stay in sync with the run’s stored policy.
- **Outputs:** README section summarizing policy knobs, enforcement points, and the lab’s role.
- **Verification:** Cross-check the policy fields in `RunPolicySchema` and confirm Lab’s `run_policy.ts` mirrors them.
- **Risks/Assumptions:** Keep the policy overview short to avoid overwhelming newcomers.
- **Confidence:** 0.74

### S4: Emphasize the Public API Surface and Consumers
- **Objective:** Point contributors to the canonical engine export surface and downstream consumers.
- **Evidence to Review:** `k_006_public_api_integration.md`, `k_001_final_state_architecture.md`.
- **Actions:**
  1. Add a “Public API” section noting `packages/engine/src/index.ts` as the single export surface.
  2. Mention Lab and Analysis as consumers (typed Convex API + export bundle usage) with a brief usage snippet.
- **Outputs:** README section clarifying the integration boundary and how to import from `@judge-gym/engine`.
- **Verification:** Confirm `packages/engine/src/index.ts` still re-exports the described items and Lab/Analysis import paths remain valid.
- **Risks/Assumptions:** Avoid documenting internal paths that are likely to change.
- **Confidence:** 0.76

### S5: Add Architecture Diagram Slots (High-Level)
- **Objective:** Provide diagram placement guidance without over-committing to volatile details.
- **Evidence to Review:** `k_001_final_state_architecture.md`, `k_003_domain_platform_layout.md`, `k_002_current_readme.md`.
- **Actions:**
  1. Propose 2–3 diagram slots in the README: system context (packages + Convex), ledger flow (`llm_requests → llm_batches → llm_messages`), and policy sync loop (Lab ↔ Convex workflows).
  2. Specify that diagrams should be high-level (Mermaid or static image) and placed near the architecture section to avoid drift.
- **Outputs:** README placeholders or text indicating where diagrams will live and what they should convey.
- **Verification:** Ensure the README indicates diagram placement and scope; avoid duplicating detailed blueprint diagrams.
- **Risks/Assumptions:** Diagram maintenance risk; consider linking to a dedicated `docs/architecture.md` if drift becomes an issue.
- **Confidence:** 0.62

---

## 6. Uncertainty Gaps

- Idempotency caveat: Documentation must note that changing prompts requires incrementing `request_version` to avoid stale reuse.
- Policy sync: Lab uses a local policy constant; README must clarify manual synchronization with server run policies.
- Diagram maintenance: Existing blueprint diagrams may drift; README diagrams should stay high-level or link to a dedicated docs page.

---

## 7. Verification Gates

1. **Evidence Gate:** Every README change maps to at least one evidence entry.
2. **Null Challenge Gate:** All hypotheses have recorded null challenges (`null_challenges/`).
3. **Clarity Gate:** README avoids internal-only file paths unless they are stable public surfaces.
4. **Accuracy Gate:** README claims match current code structure and schema definitions.

---

## 8. Next Steps (Execution)

1. Implement S1–S5 in `README.md`.
2. If diagrams are desired, decide Mermaid vs. static assets and confirm placement.
3. Run a quick README review to verify the new architecture text matches the codebase.

---

## Appendix: Sources

- `knowledge/k_001_final_state_architecture.md`
- `knowledge/k_002_current_readme.md`
- `knowledge/k_003_domain_platform_layout.md`
- `knowledge/k_004_idempotent_llm_requests.md`
- `knowledge/k_005_policy_batching_rate_limit.md`
- `knowledge/k_006_public_api_integration.md`
