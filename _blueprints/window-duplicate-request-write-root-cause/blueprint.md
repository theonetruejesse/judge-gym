# Blueprint: Window duplicate request writes root cause

This blueprint explains why the same `llm_requests` rows are written repeatedly and why duplicate apply/finalize telemetry persists, then lays out an execution plan with measurable acceptance gates.

## 0. Run Metadata

- Run Folder: `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/window-duplicate-request-write-root-cause`
- Research Question: Identify root causes of repeated writes and duplicate apply/finalize telemetry in window flow, and propose high-confidence architectural fixes with verification plan.
- Scope: Window/run orchestration idempotency, scheduler/workflow concurrency controls, telemetry churn reduction.
- Non-goals: Provider-level model quality changes; analysis package pipeline.
- Constraints: Keep Convex scheduler architecture; preserve debuggability; optimize DB write/bandwidth overhead.

## 1. Evidence Ledger

- `k_001_window_apply_duplicate_branch`: duplicate apply branch always patches request + emits duplicate event.
- `k_002_job_reentry_no_claim`: running jobs have no claim/lease guard unlike batches.
- `k_003_patch_request_write_amplification`: request patch + target snapshot refresh are unconditional.
- `k_004_batch_finalizing_reentry_window`: batch finalizing can re-enter if lease expires.
- `k_005_empirical_window_ab_baseline`: A/B rerun still shows very high duplicate churn.
- `k_006_convex_execution_model_constraints`: Convex semantics require application-level idempotency and ownership guards.

## 2. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Window apply idempotency path | Goodall | k_001 |
| A_02 | Scheduler/workflow re-entry controls | Lovelace | k_002, k_004 |
| A_03 | Request/snapshot write amplification | Peirce | k_003 |
| A_04 | Empirical telemetry + platform constraints | codex-main | k_005, k_006 |

## 3. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_job_reentry_001 | Missing job claim/lease is a dominant source of duplicate apply/finalize churn. | k_002, k_005 | 0.85 |
| h_A_request_idempotency_002 | Unconditional request/snapshot patching materially amplifies write volume. | k_001, k_003, k_005 | 0.91 |
| h_A_terminal_ordering_003 | Post-terminal events are mainly duplicate-handler artifacts. | k_005 | 0.38 (falsified as stated) |

## 4. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_job_reentry_001 | Passed (not falsified) | No job claim API found; batch has claims |
| h_A_request_idempotency_002 | Passed with uncertainty | Replay test suppresses duplicates in one scenario |
| h_A_terminal_ordering_003 | Failed (falsified) | Normal handler ordering can emit post-terminal events |

Artifacts:
- `null_challenges/nc_h_A_job_reentry_001_challenge.json`
- `null_challenges/nc_h_A_request_idempotency_002_challenge.json`
- `null_challenges/nc_h_A_terminal_ordering_003_challenge.json`

## 5. Root Cause Synthesis (What is actually happening)

1. Duplicate apply branch is intentionally writable and currently noisy.
- `window_service.applyRequestResult` checks `if (evidence[outputField])` then still patches request + emits `request_apply_duplicate_success`.
- This branch is hit whenever any re-entry path reapplies a completed target.

2. Running jobs are re-enterable concurrently.
- Scheduler dispatches running jobs without ownership lease.
- `processRunningJobWorkflow` has no claim/CAS barrier and can finalize repeatedly.
- This matches repeated `job_finalized` counts in telemetry.

3. `patchRequest` guarantees writes even when state is unchanged.
- Every patch writes `llm_requests` and refreshes `process_request_targets`.
- Snapshot refresh updates timestamp every time, causing unavoidable write churn.

4. Post-terminal events are not always pathological.
- Some post-terminal events come from handler ordering (terminal event emitted inside `maybeAdvance*`, then caller emits `request_applied`).
- So `events_after_terminal > 0` is only partially a duplicate-signal.

## 6. Prebuilt Implementation Plan

### S1: Add Job Ownership Lease (Primary concurrency fix)

- Objective: Prevent concurrent running-job workflows on the same `llm_job`.
- Evidence to Review: `k_002`, `k_006`.
- Inputs: `llm_job_repo.ts`, `process_workflows.ts`, `scheduler.ts`, schema models/indexes.
- Actions:
  1. Add job claim fields (owner + expires_at) in `llm_jobs`.
  2. Add claim/release mutations analogous to batch claim flow.
  3. Require claim success before queued/running job handlers proceed.
  4. Update scheduler to skip claimed running jobs.
- Outputs: job claim primitives + guarded workflow execution.
- Verification:
  - Replayed/parallel running-job invocation yields single `job_finalized` transition.
  - `jobs_finalized_multiple_times == 0` on matched window test.
- Risks/Assumptions: lease TTL tuning; stale claims require safe expiry handling.
- Confidence: 0.90

### S2: Make Finalize Idempotent via CAS Transition

- Objective: Ensure `job_finalized` emits only when status actually transitions.
- Evidence to Review: `k_002`, `k_005`.
- Inputs: `process_workflows.ts`, `llm_job_repo.ts`.
- Actions:
  1. Replace blind patch finalize with mutation that verifies expected status and owner.
  2. Emit finalize telemetry only when mutation returns `transitioned=true`.
- Outputs: one-way terminal transition semantics.
- Verification:
  - Duplicate action replay cannot produce duplicate finalize events.
- Risks/Assumptions: must not block legitimate error->success recovery flows (if any).
- Confidence: 0.88

### S3: Add No-op Patch Guard for Requests and Target Snapshots

- Objective: Stop write amplification when patch payload does not change persisted state.
- Evidence to Review: `k_003`, `k_005`.
- Inputs: `llm_request_repo.ts`.
- Actions:
  1. In `patchRequest`, compare payload fields against current row; skip patch when unchanged.
  2. In `refreshProcessRequestTargetState`, compare computed payload against existing snapshot; skip patch when unchanged.
  3. Avoid timestamp-only writes when business fields are unchanged.
- Outputs: reduced DB writes/bandwidth from no-op updates.
- Verification:
  - Same test run yields materially fewer writes to `llm_requests` and `process_request_targets`.
- Risks/Assumptions: field comparisons must include nullable semantics correctly.
- Confidence: 0.92

### S4: Tighten Apply Idempotency in run/window handlers

- Objective: Prevent repeated `request_apply_duplicate_success` noise from already-successful request rows.
- Evidence to Review: `k_001`, `k_003`, `k_005`.
- Inputs: `window_service.ts`, `run_service.ts`.
- Actions:
  1. Before patching in duplicate branch, load request and return early if already `success` with equivalent output metadata.
  2. Optionally collapse duplicate-success telemetry to a bounded/sampled event.
- Outputs: lower duplicate event churn without losing core success semantics.
- Verification:
  - `duplicate_apply_success_total` drops sharply in matched window run.
- Risks/Assumptions: decide desired forensic verbosity vs cost.
- Confidence: 0.89

### S5: Define explicit terminal event policy

- Objective: Distinguish benign post-terminal ordering from true duplicate-late work.
- Evidence to Review: null challenge outputs + `k_005`.
- Inputs: `run_service.ts`, `window_service.ts`, telemetry conventions.
- Actions:
  1. Decide policy: reorder emits, suppress certain post-terminal emits, or reclassify as `post_terminal_observed`.
  2. Document policy in debug docs and telemetry conventions.
- Outputs: clear interpretation of `events_after_terminal` metric.
- Verification:
  - Metric meaning is stable and actionable in `debug:analyze`.
- Risks/Assumptions: over-suppression may reduce debugging visibility.
- Confidence: 0.62

### S6: A/B validation harness and acceptance gates

- Objective: Prove infra optimization with hard metrics before rollout.
- Evidence to Review: `k_005`, certainty report.
- Inputs: `debug:analyze`, `docs/telemetry_baselines.md`.
- Actions:
  1. Run matched window baseline after each step batch.
  2. Record metrics in telemetry baseline doc.
  3. Gate merge on thresholds below.
- Outputs: repeatable decision framework.
- Verification thresholds:
  - `duplicate_apply_success_total <= 5`
  - `jobs_finalized_multiple_times == 0`
  - `max_job_finalized_per_job == 1`
  - `events_after_terminal <= 2` (or policy-adjusted)
  - total sampled events reduced by >=50% vs Baseline A.
- Risks/Assumptions: evidence set size and provider latency must be held constant.
- Confidence: 0.94

## 7. Validation Gates

1. Evidence Sufficiency Gate: each step references at least one `k_` artifact.
2. Conflict Gate: falsified hypothesis (`h_A_terminal_ordering_003`) not used as a primary justification.
3. Null Challenge Gate: all hypotheses challenged and outcomes recorded.
4. Verification Gate: numeric acceptance thresholds defined before code rollout.

## 8. Open Questions

- Should duplicate-success telemetry be retained as sampled diagnostic events instead of removed?
- Should job claims include heartbeat extension or fixed TTL with takeover semantics?
- Do we want a lightweight `request_inflight_owner` reservation to stop duplicate provider calls per request row?

## Appendix: Sources

- Local code references in `knowledge/` artifacts.
- Convex docs:
  - https://docs.convex.dev/scheduling/scheduled-functions
  - https://docs.convex.dev/api/interfaces/server.Scheduler
  - https://docs.convex.dev/production/state/limits
