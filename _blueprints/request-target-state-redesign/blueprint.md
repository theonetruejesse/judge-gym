# Blueprint: request target state redesign

> Redesign request-state storage so `llm_requests` remains the attempt-history lane, `process_request_targets` becomes an explicit current-target snapshot, and downstream diagnostics stop conflating historical retries with terminal failures. Remove `assistant_reasoning` in the same pass. This plan assumes a destructive reset is acceptable on the fresh dev project after the code changes land.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/request-target-state-redesign`
- **Research Question:** How should `llm_requests` and `process_request_targets` be redesigned so `llm_requests` is a clean attempt log, `process_request_targets` reflects current logical target truth instead of historical residue, `assistant_reasoning` is removed, and downstream `run_service` / `codex` / `lab` consumers remain correct after a destructive reset and rebuild?
- **Scope:** `packages/engine/convex/models/llm_calls.ts`, `domain/llm_calls/*`, `domain/runs/*`, `domain/window/*`, `domain/maintenance/codex.ts`, `packages/lab.ts`, related tests/docs.
- **Non-goals:** parser redesign, prompt-template caching, provider API redesign, preserving this dev dataset.
- **Constraints:** keep `llm_request_id` references stable enough for artifacts, preserve retry behavior, and do the redesign as a coordinated change rather than a partial field tweak.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` is the registry for assignments, evidence, hypotheses, and certainty.

- **Researchers:** Faraday (`A_01`), Archimedes (`A_02`), Cicero (`A_03`)
- **Falsifier:** Helmholtz
- **Certainty Scorer:** Plato
- **Synthesizer:** main

---

## 2. Evidence Ledger (Grounding)

- `knowledge/k_001_attempt_log_semantics.md`
  - `llm_requests` already behaves like an attempt ledger: retries create new rows; artifacts point back to the specific request row that produced them.
- `knowledge/k_002_target_snapshot_semantics.md`
  - `process_request_targets` is a derived snapshot that stores pending/error residue but no explicit success/current-resolution field.
- `knowledge/k_003_consumer_contracts.md`
  - Core orchestration mostly needs target-truth state, while diagnostics surfaces currently mix target truth with attempt history.
- `knowledge/k_004_reasoning_field_value.md`
  - `assistant_reasoning` has low value and no in-repo read-side consumers.

**Critical gaps resolved by falsification**
- The repo does **not** already treat `process_request_targets` as authoritative truth.
- Window logic still reads raw `llm_requests` in some places.
- Explicit terminal resolution is the right redesign direction, but it will require coordinated consumer rewrites.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| `A_01` | Current schema and write semantics for `llm_requests` / `process_request_targets` | Faraday | `k_001`, `k_002`, `k_004` |
| `A_02` | Downstream consumer contracts in runs / lab / codex | Archimedes | `k_002`, `k_003` |
| `A_03` | Migration/reset implications on the fresh dev project | Cicero | `k_001`, `k_003`, `k_004` |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| `h_A_01_001` | Keep `llm_requests` as the attempt-history lane and redesign `process_request_targets` into explicit current target truth. | `k_001`, `k_002`, `k_003` | `0.62` |
| `h_A_02_001` | Terminal failure must be represented explicitly on target rows rather than inferred from `!has_pending && max_attempts >= cap`. | `k_002`, `k_003` | `0.88` |
| `h_A_03_001` | Remove `assistant_reasoning` from `llm_requests`. | `k_004` | `0.95` |

**Interpretation**
- `h_A_01_001` remains directionally correct, but the falsifier showed the implementation must keep `llm_requests` operational and must update window consumers too.

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| `h_A_01_001` | Failed as phrased | Windows still read `llm_requests` directly; `process_request_targets` is currently derived, not authoritative. |
| `h_A_02_001` | Failed as a drop-in assumption | Current consumers and tests are inference-based and must be rewritten together. |
| `h_A_03_001` | Passed | No in-repo read-side consumers of `assistant_reasoning`. |

**Net effect**
- The redesign is still justified, but it must be implemented as a coordinated service+schema rewrite, not a narrow field swap.

---

## 6. Certainty Scoring Summary

- **Report:** `certainty/certainty_report.md`
- **Highest-confidence move:** remove `assistant_reasoning` (`S1 = 0.95`)
- **Lowest-confidence move:** adapt `llm_request_repo` and related retry/write semantics (`S3 = 0.72`)
- **Reason:** request state is patched from multiple services/repos, so the change surface is larger than a single schema edit.

---

## 7. Prebuilt Implementation Plan

### S1: Remove `assistant_reasoning`

- **Objective:** eliminate an inconsistent field with no meaningful consumer value.
- **Evidence to Review:** `k_004_reasoning_field_value.md`
- **Inputs:** `packages/engine/convex/models/llm_calls.ts`, `domain/runs/run_service.ts`, tests touching request rows.
- **Actions:**
  1. Remove `assistant_reasoning` from `LlmRequestsTableSchema`.
  2. Remove the parse-failure write in `run_service`.
  3. Confirm diagnostics still use `assistant_output_preview` and `last_error` only.
- **Outputs:** simplified `llm_requests` schema and write path.
- **Verification:** repo search finds no `assistant_reasoning` references; tests pass; typecheck passes.
- **Risks/Assumptions:** assumes no external consumer outside the repo depends on this field.
- **Confidence:** `0.95`

### S2: Redesign `process_request_targets` schema around explicit current-target resolution

- **Objective:** make target rows represent current logical truth instead of inferred mixtures of pending state and historical residue.
- **Evidence to Review:** `k_002_target_snapshot_semantics.md`, `k_003_consumer_contracts.md`
- **Inputs:** `packages/engine/convex/models/llm_calls.ts`, `domain/runs/run_progress.ts`, `domain/maintenance/codex.ts`.
- **Actions:**
  1. Replace the current snapshot shape with explicit fields such as:
     - `resolution` (`pending | retryable | exhausted | succeeded`)
     - `active_request_id`
     - `latest_request_id`
     - `latest_error_request_id`
     - `attempt_count`
     - `retry_count`
     - `oldest_pending_ts`
  2. Drop or rename `max_attempts` so the field no longer implies human-readable attempt counts.
  3. Keep minimal historical summary fields only if required for Codex/UI, but do not let them define terminal truth.
- **Outputs:** revised target snapshot schema.
- **Verification:** target row alone can answer “is this target currently pending / retryable / exhausted / succeeded?” without joining artifacts or inferring from attempt count.
- **Risks/Assumptions:** all target-truth consumers can be migrated in the same pass.
- **Confidence:** `0.89`

### S3: Rework request/target write semantics in `llm_request_repo` and request lifecycle services

- **Objective:** keep `llm_requests` as the operational attempt log while ensuring target snapshots are refreshed with explicit semantics.
- **Evidence to Review:** `k_001_attempt_log_semantics.md`, `k_002_target_snapshot_semantics.md`
- **Inputs:** `domain/llm_calls/llm_request_repo.ts`, `llm_job_service.ts`, `llm_batch_service.ts`, `domain/runs/run_service.ts`, `domain/window/window_service.ts`.
- **Actions:**
  1. Preserve per-attempt rows in `llm_requests`.
  2. Standardize attempt numbering to an explicit `attempt_index` or equivalent human-readable semantics.
  3. Ensure every status/transport mutation that matters to current target truth triggers a target snapshot refresh.
  4. Update refresh logic to compute explicit `resolution` rather than only `has_pending/max_attempts/latest_error_*`.
- **Outputs:** consistent request lifecycle semantics and correct target snapshots.
- **Verification:** a target that succeeds on its last allowed retry ends as `resolution = succeeded`, not exhausted.
- **Risks/Assumptions:** change surface spans more than one repo/service; direct repo patches to request rows must be audited.
- **Confidence:** `0.72`

### S4: Split target truth from attempt history in `lab` and `codex`

- **Objective:** stop operator-facing APIs from presenting historical retries as terminal failures.
- **Evidence to Review:** `k_003_consumer_contracts.md`, `null_challenges/nc_request_target_state_redesign.json`
- **Inputs:** `packages/engine/convex/packages/lab.ts`, `domain/maintenance/codex.ts`, `domain/runs/experiments_data.ts`.
- **Actions:**
  1. Make target-truth summaries the default reporting path.
  2. Rename request-history rollups to make them clearly historical, e.g. `attempt_rollup`, `historical_failed_attempts`.
  3. Drive `has_failures`, `error_summary`, and auto-heal decisions from explicit target `resolution` rather than `max_attempts >= cap`.
- **Outputs:** cleaner health and diagnostics APIs.
- **Verification:** completed runs with successful retries report zero terminal failures while still exposing historical failed attempts separately.
- **Risks/Assumptions:** UI and scripts consuming these fields will be updated in lockstep.
- **Confidence:** `0.87`

### S5: Update window consumers that still read raw `llm_requests` for target semantics

- **Objective:** make run and window orchestration converge on the same target-truth model.
- **Evidence to Review:** falsifier findings in `nc_request_target_state_redesign.json`, `k_003_consumer_contracts.md`
- **Inputs:** `domain/window/window_orchestrator.ts`, `domain/window/window_service.ts`, related tests.
- **Actions:**
  1. Replace raw pending/error request inference with target snapshot reads where possible.
  2. If window flows need richer state than runs, add it to the target snapshot model rather than re-deriving it ad hoc from request rows.
  3. Align window failure detection with the redesigned run semantics.
- **Outputs:** consistent process-state logic across runs and windows.
- **Verification:** window stage advancement no longer relies on raw `llm_requests` scans for terminal state.
- **Risks/Assumptions:** this is the main falsifier-driven widening of scope.
- **Confidence:** `0.74`

### S6: Validate, then destructively reset and rerun canaries

- **Objective:** prove the redesign before rebuilding experimental data.
- **Evidence to Review:** `certainty/certainty_report.md`, `k_001`–`k_004`
- **Inputs:** focused tests, codex reset tooling, canary runbook.
- **Actions:**
  1. Add targeted tests for:
     - successful-on-last-attempt targets,
     - exhausted targets,
     - historical failed attempts on ultimately successful targets,
     - window target-state semantics.
  2. Run `bun run typecheck` and the targeted Convex tests.
  3. Nuke request/run tables on the fresh dev deployment.
  4. Rerun the canary window + canary experiment + randomization matrix.
- **Outputs:** fresh deployment with corrected state semantics and validated canaries.
- **Verification:** target snapshots, diagnostics, and health surfaces agree on terminal truth after reruns.
- **Risks/Assumptions:** assumes the dev reset is still acceptable once implementation is ready.
- **Confidence:** `0.90`

---

## 8. Validation Gates

1. **Schema Gate:** `assistant_reasoning` removed; new target-resolution schema compiles.
2. **Consumer Gate:** no run/window/codex/lab path still infers terminal failure from `!has_pending && max_attempts >= cap`.
3. **Behavior Gate:** a success-on-final-retry target ends as succeeded in all summaries.
4. **Reset Gate:** destructive reset is performed only after tests pass.
5. **Canary Gate:** post-reset canaries complete with consistent target truth and diagnostics.

---

## 9. Open Questions

- Should `process_request_targets` remain derived from `llm_requests`, or become the authoritative operational target row updated directly by lifecycle services?
- Do we want a separate lightweight attempt-summary table for UI/debug surfaces, or should `llm_requests` remain the only forensic source?
- When `llm_prompt_templates` arrives, should `llm_requests` keep compact render vars only, or also preserve a rendered prompt preview for debugging?

---

## Appendix: Sources

- `knowledge/k_001_attempt_log_semantics.md`
- `knowledge/k_002_target_snapshot_semantics.md`
- `knowledge/k_003_consumer_contracts.md`
- `knowledge/k_004_reasoning_field_value.md`
- `null_challenges/nc_request_target_state_redesign.json`
- `certainty/certainty_report.md`
