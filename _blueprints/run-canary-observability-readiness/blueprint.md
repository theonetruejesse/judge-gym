# Blueprint: run-canary-observability-readiness

Low-risk execution plan to validate run-flow reliability and observability before launching the full experiment matrix.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/run-canary-observability-readiness`
- **Research Question:** Design low-risk canary test specifications and observability coverage for judge-gym run flow before full experiment matrix.
- **Scope:** run-flow canaries, telemetry/readiness gates, reset strategy with optional window preservation, recovery playbook.
- **Non-goals:** implementing new runtime features in this phase.
- **Constraints:** keep blast radius low; use existing codex/lab surfaces; preserve evidence windows unless explicit full wipe.

---

## 1. Evidence Ledger

- `k_001` telemetry surface + gaps: `knowledge/k_001_telemetry_surface.md`
- `k_002` failure mode coverage in run/window/job/batch services: `knowledge/k_002_failure_modes_and_guards.md`
- `k_003` staged canary flow aligned to existing scripts: `knowledge/k_003_canary_specs.md`
- `k_004` reset boundaries and run-scoped cleanup constraints: `knowledge/k_004_reset_boundaries.md`
- `k_005` Convex OCC/action/scheduler observability constraints: `knowledge/k_005_convex_external_constraints.md`

Critical gaps identified:
- Telemetry emit is fail-open and can silently drop events under contention (`k_001`).
- `deleteRunData` is correct for preservation boundaries but not “safest possible” yet due to broad scans / missing active-run guard (`k_004`).
- `1 -> 4` target canary is insufficient alone; intermediate scale gate required (`null_challenges/nc_h_A_03_001_challenge.json`).

---

## 2. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Telemetry and debug surface coverage | Sartre | k_001 |
| A_02 | Failure-mode coverage and residual risks | Bernoulli | k_002 |
| A_03 | Staged canary test specs | Hubble | k_003 |
| A_04 | Reset/nuke boundaries with window preservation | Lovelace | k_004 |
| A_05 | External Convex reliability constraints | Zeno | k_005 |

---

## 3. Micro-Hypotheses

| Hypothesis ID | Statement | Outcome | Confidence |
| :------------ | :-------- | :------ | :--------- |
| `h_A_01_001` | Existing telemetry is sufficient if explicit degradation gates are added | Passed falsification | 0.76 |
| `h_A_02_001` | Residual risk is mostly scale/read-pressure backlog | Failed falsification (confidence reduced) | 0.62 |
| `h_A_03_001` | `1 -> 4` canary ladder is sufficient alone | Failed falsification | 0.58 |
| `h_A_04_001` | `deleteRunData` is safest reset primitive | Failed falsification (needs guardrails) | 0.66 |
| `h_A_05_001` | External logs + OCC/backlog alerting are required for production confidence | Passed falsification | 0.79 |

---

## 4. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| `h_A_01_001` | Passed | `codex.ts` approximation computation + `emit.ts` fail-open behavior |
| `h_A_02_001` | Failed | Canaries low fanout; matrix-scale behavior remains under-tested |
| `h_A_03_001` | Failed | Need intermediate-scale gate before full matrix |
| `h_A_04_001` | Failed | `deleteRunData` broad scans and no explicit active-run guard |
| `h_A_05_001` | Passed | Convex docs: dashboard logs limited, stream logs for durable history |

---

## 5. Prebuilt Implementation Plan

### S1: Telemetry Preflight And Integrity Baseline
- **Objective:** ensure observability is trustworthy before any run canary.
- **Evidence to review:** `k_001`, `k_005`.
- **Inputs:** `packages/codex:getProcessHealth`, `packages/codex:analyzeProcessTelemetry`, `packages/lab:getTraceEvents`.
- **Actions:**
  1. For a known completed run/window, run `debug:analyze` and record sequence integrity, counter match, duplicate apply total, job finalize multiplicity, events-after-terminal.
  2. Define hard failure thresholds for canary phase: any sequence/counter mismatch, duplicate apply > 0, job finalized >1, stuck reason persistent >2 intervals.
- **Outputs:** baseline metrics sheet in canary notes.
- **Verification:** thresholds documented and reviewed before run launch.
- **Risks/assumptions:** telemetry may still silently degrade (fail-open emit).
- **Confidence:** 0.86.

### S2: Reset Boundaries And Preservation Workflow
- **Objective:** enforce safe cleanup policy while preserving windows/evidence.
- **Evidence to review:** `k_004`, `nc_h_A_04_001_challenge.json`.
- **Inputs:** `domain/maintenance/danger:deleteRunData`, `domain/maintenance/danger:nukeTablesPass`.
- **Actions:**
  1. Default cleanup path: run-scoped cleanup only (`deleteRunData`) for completed/aborted canaries.
  2. Reserve global nuke (`nukeTablesPass`) for full reset only when preserving windows is not required.
  3. Add operator guardrail checklist: never delete active run; snapshot run summary first.
- **Outputs:** reset protocol checklist for canary operator.
- **Verification:** a dry-run cleanup and one real cleanup preserve windows/evidence while removing run artifacts.
- **Risks/assumptions:** `deleteRunData` scan cost can rise with history.
- **Confidence:** 0.74.

### S3: Canary Stage-0 API Wiring Check
- **Objective:** validate experiment/evidence wiring before run orchestration.
- **Evidence to review:** `k_003`.
- **Inputs:** `packages/lab:listExperiments`, `getExperimentSummary`, `listExperimentEvidence`, `initExperiment`.
- **Actions:**
  1. Clone a run-ready experiment from existing evidence set.
  2. Confirm evidence rows non-empty and config payload valid.
- **Outputs:** new experiment id.
- **Verification:** `initExperiment` success and expected evidence count.
- **Risks/assumptions:** none material.
- **Confidence:** 0.84.

### S4: Canary Stage-1 Smoke Run (`target_count=1`)
- **Objective:** confirm end-to-end happy path with minimal fanout.
- **Evidence to review:** `k_003`, `k_002`.
- **Inputs:** `packages/lab:startExperimentRun`, `debug:watch`, `debug:stuck`, `debug:analyze`.
- **Actions:**
  1. Start run with `target_count=1`.
  2. Monitor until terminal; run `debug:analyze` after completion.
- **Outputs:** smoke-run telemetry snapshot.
- **Verification:** terminal `completed`, no persistent stuck reasons, duplicate apply 0, job multiple finalization 0.
- **Risks/assumptions:** may not expose scale-path contention.
- **Confidence:** 0.88.

### S5: Canary Stage-2 Medium Run (`target_count=4`)
- **Objective:** exercise mixed-stage orchestration with controlled fanout.
- **Evidence to review:** `k_003`, `k_002`.
- **Inputs:** same as S4 + `packages/lab:getRunDiagnostics`.
- **Actions:**
  1. Start `target_count=4` from same experiment class.
  2. Collect diagnostics and route/churn summary.
- **Outputs:** medium-run canary report.
- **Verification:** complete within SLA, no duplicate apply churn, no repeated finalization, no unresolved pending stage.
- **Risks/assumptions:** still below matrix pressure.
- **Confidence:** 0.81.

### S6: Canary Stage-3 Intermediate Scale (`target_count=10`)
- **Objective:** bridge between low-fanout canary and full matrix scale.
- **Evidence to review:** `nc_h_A_03_001_challenge.json`, `k_002`, `k_005`.
- **Inputs:** same monitoring stack; optional Convex usage/lag dashboard.
- **Actions:**
  1. Start one `target_count=10` run on preserved windows/evidence.
  2. Watch for read-limit/OCC/scheduler lag symptoms and apply one safe-heal cycle if needed.
- **Outputs:** intermediate-scale reliability profile.
- **Verification:** completes without read-limit hard failures and without repeated stuck cycles.
- **Risks/assumptions:** may expose new scale-only behavior.
- **Confidence:** 0.77.

### S7: Recovery-Path Drill (Safe Auto-Heal)
- **Objective:** validate operational recovery loop before production matrix.
- **Evidence to review:** `k_001`, `k_003`.
- **Inputs:** `debug:stuck`, `debug:heal` dry-run/apply.
- **Actions:**
  1. On a staged stall (or naturally observed stall), execute dry-run then apply heal.
  2. Confirm only safe actions are planned/applied.
- **Outputs:** recovery transcript for runbook.
- **Verification:** progress resumes within two watch intervals.
- **Risks/assumptions:** repeated heal cycles indicate deeper defect.
- **Confidence:** 0.85.

### S8: Go/No-Go Gate For Full Matrix
- **Objective:** make explicit launch decision for full experiment matrix.
- **Evidence to review:** all `k_*`, all canary outputs, `certainty/certainty_report.md`.
- **Inputs:** consolidated canary metrics.
- **Actions:**
  1. Approve launch only if S4-S7 pass and no critical stuck/failure indicators remain.
  2. Freeze launch if any critical gate fails; run focused fix loop first.
- **Outputs:** signed go/no-go decision and matrix execution checklist.
- **Verification:** documented decision with metric evidence.
- **Risks/assumptions:** gating strictness must match budget/risk tolerance.
- **Confidence:** 0.80.

---

## 6. Validation Gates

1. **Telemetry Integrity Gate:** no sequence/counter mismatch; duplicate apply total = 0; repeated finalization = 0.
2. **Stall Recovery Gate:** no unresolved stuck reasons after one safe-heal cycle.
3. **Scale Bridge Gate:** `target_count=10` run succeeds without hard read-limit collapse.
4. **Reset Safety Gate:** run cleanup preserves windows/evidence and does not use global-time telemetry truncation.
5. **Observability Gate:** for canary period, retain enough trace/log data for postmortem (including external logs if available).

---

## 7. Open Questions

- Should `getProcessHealth` expose an explicit `approximate` flag to operators?
- Should `deleteRunData` gain active-run guard + chunked/indexed transport deletion before repeated large loops?
- What exact SLA thresholds (time-to-terminal per stage) do you want for go/no-go?

---

## Appendix: Sources

- Internal evidence artifacts under `knowledge/`, `hypotheses/`, `null_challenges/`, `certainty/`.
- Key repo files:
  - `packages/engine/convex/domain/maintenance/codex.ts`
  - `packages/engine/convex/domain/llm_calls/*.ts`
  - `packages/engine/convex/domain/runs/*.ts`
  - `packages/engine/convex/domain/window/*.ts`
  - `packages/engine/convex/domain/maintenance/danger.ts`
  - `packages/engine/scripts/live_debug.ts`
  - `packages/engine/scripts/synthetic_matrix.ts`
- Convex docs:
  - `https://docs.convex.dev/database/advanced/occ`
  - `https://docs.convex.dev/error`
  - `https://docs.convex.dev/functions/actions`
  - `https://docs.convex.dev/scheduling/scheduled-functions`
  - `https://docs.convex.dev/production/integrations/log-streams/`
  - `https://docs.convex.dev/functions/debugging`
