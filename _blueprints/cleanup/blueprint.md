# Blueprint: Orchestrator Cleanup (Registry/Scheduler/Window)

> Define clean boundaries between orchestrator, registry, scheduler, and window evidence flow. Identify what is left to wire for end-to-end evidence processing and outline a safe, testable refactor path.
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** `_blueprints/cleanup`
- **Research Question:** Refactor orchestrator/registry/scheduler/window flow; define boundaries and what’s left to wire and test evidence flow
- **Scope:** Orchestrator registry boundaries, request requeue/apply routing, evidence ingestion + stage transitions, evidence flow testability
- **Non-goals:** Implementing experiment/run orchestration; schema redesign outside evidence/orchestrator scope
- **Constraints:** No code changes in this run. Follow Convex style (zod helpers, underscore filenames). Use BaseOrchestrator where possible.

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

- `k_001`: BaseOrchestrator owns request creation and batch/job routing. (packages/engine/convex/domain/orchestrator/base.ts)
- `k_002`: `target_registry` is window-specific and hardcodes provider. (packages/engine/convex/domain/orchestrator/target_registry.ts)
- `k_003`: LLM services hardwire window applyRequestResult. (packages/engine/convex/domain/llm_calls/llm_job_service.ts, packages/engine/convex/domain/llm_calls/llm_batch_service.ts)
- `k_004`: Window evidence flow lacks ingestion and auto stage progression. (packages/engine/convex/domain/window/window_service.ts, window_repo.ts)
- `k_005`: Refactor-everything uses stage workflows + centralized scheduler. (refactor-everything:packages/engine/convex/domain/evidence/workflows/evidence_collect.ts, runs/workflows/runs_scheduler.ts)

Critical gaps:
- No evidence ingestion mutation inserts Firecrawl results into `evidences`.
- No stage completion logic advances `windows.current_stage` or enqueues next stages.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Orchestrator/registry/scheduler boundaries | 019c8762-b2a7-77e3-a6d5-2a4c3c217907 | k_001, k_002, k_003 |
| A_02 | Window evidence flow wiring | 019c8762-b908-74f0-ac5d-b2733ca36576 | k_004 |
| A_03 | Refactor-everything patterns | 019c8762-bf9e-7fa2-880b-85fceafee67a | k_005 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_01_001 | Route apply-result + requeue via a domain handler registry; remove window hardwiring from llm_calls services. | k_002, k_003 | 0.64 |
| h_A_02_001 | Evidence flow is incomplete: missing evidence ingestion and auto stage progression. | k_004 | 0.68 |
| h_A_03_001 | Refactor-everything’s stage workflow + scheduler separation is a useful pattern for cleanup. | k_005 | 0.57 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_01_001 | Passed | Registry exists only for requeue; apply-result still hardwired. (packages/engine/convex/domain/orchestrator/target_registry.ts, llm_job_service.ts, llm_batch_service.ts) |
| h_A_02_001 | Passed (partial) | Stage processing works once evidences exist, but ingestion and stage chaining still missing. (packages/engine/convex/domain/window/window_service.ts, window_orchestrator.ts) |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** TBD by certainty scorer.

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

### Steps

#### S1: Define Registry Contracts for Request Routing

- **Objective:** Standardize routing of `applyRequestResult` and `requeueRequest` by custom key without hardwiring window domain.
- **Evidence to Review:** k_002, k_003
- **Inputs:** `packages/engine/convex/domain/orchestrator/target_registry.ts`, `packages/engine/convex/domain/llm_calls/llm_job_service.ts`, `packages/engine/convex/domain/llm_calls/llm_batch_service.ts`
- **Actions:**
  1. Define a target handler interface: `{ targetType, applyResult(ctx, request, output), requeue(ctx, request) }`.
  2. Move window-specific apply/requeue handlers into `packages/engine/convex/domain/window/`.
  3. Update `target_registry` to be a pure key switch/registry that delegates to handlers; remove `WindowOrchestrator` instantiation.
  4. Update llm_calls services to resolve apply-result handler via registry (parallel to requeue path).
- **Outputs:** Registry contract + window handler module; llm_calls services no longer import window_service directly.
- **Verification:** Unit tests or quick smoke test showing custom_key routes to correct handler for both apply and requeue.
- **Risks/Assumptions:** Assumes custom_key prefixes remain stable; requires handler registration when new domains are added.
- **Confidence:** 0.63

#### S2: Normalize Custom Key Conventions

- **Objective:** Ensure request/process key format is consistent across orchestrators and registries.
- **Evidence to Review:** k_001, k_002
- **Inputs:** `packages/engine/convex/domain/orchestrator/base.ts`, `packages/engine/convex/domain/window/window_orchestrator.ts`
- **Actions:**
  1. Define a key format convention (e.g., `<targetType>:<id>:<stage>` and `<processType>:<id>:<stage>`).
  2. Add lightweight validators/helpers in BaseOrchestrator or a shared module.
  3. Update window orchestrator to use the shared helpers and remove ad-hoc parsing where feasible.
- **Outputs:** Shared key helper + updated window orchestrator parsing.
- **Verification:** Unit test verifying parse/make round-trips for keys.
- **Risks/Assumptions:** Requires agreement on stable prefixes; changes may affect existing stored keys if requeue uses them.
- **Confidence:** 0.58

#### S3: Add Evidence Ingestion Mutation

- **Objective:** Persist Firecrawl results into `evidences` so orchestration has targets.
- **Evidence to Review:** k_004
- **Inputs:** `packages/engine/convex/domain/window/window_repo.ts`, `packages/engine/convex/domain/window/evidence_search.ts`, `packages/engine/convex/models/window.ts`
- **Actions:**
  1. Add a mutation to insert evidences for a window (title, url, `l0_raw_content`).
  2. Update the existing search action to call this mutation (or add a service wrapper that does both search + insert).
  3. Ensure dedupe on URL if needed (optional for first pass).
- **Outputs:** Evidence ingestion path that yields rows discoverable by `WindowOrchestrator.listPendingTargets`.
- **Verification:** Create a window, run ingestion, assert `evidences` rows exist with `l0_raw_content` populated.
- **Risks/Assumptions:** Firecrawl results are valid; dedupe strategy is TBD.
- **Confidence:** 0.60

#### S4: Stage Progression and Auto-Enqueue

- **Objective:** Advance `windows.current_stage` and enqueue next stage when all evidence items finish a stage.
- **Evidence to Review:** k_004
- **Inputs:** `packages/engine/convex/domain/window/window_service.ts`, `packages/engine/convex/domain/window/window_orchestrator.ts`
- **Actions:**
  1. Add a window-level completion check for stage output fields across evidences.
  2. On stage completion, update `windows.current_stage` and call `enqueueWindowStage(nextStage)`.
  3. Ensure idempotency if multiple requests complete concurrently.
- **Outputs:** Automatic progression from `l1_cleaned` → `l2_neutralized` → `l3_abstracted`.
- **Verification:** Simulate completion of all l1 requests and confirm l2 requests are enqueued.
- **Risks/Assumptions:** Needs careful concurrency handling to avoid duplicate enqueue.
- **Confidence:** 0.55

#### S5: End-to-End Evidence Flow Smoke Test

- **Objective:** Validate the full pipeline: window creation → evidence ingestion → l1/l2/l3 processing → completion.
- **Evidence to Review:** k_001, k_003, k_004
- **Inputs:** Orchestrator, registry, scheduler, window service paths.
- **Actions:**
  1. Create a window with a small limit; ingest evidence.
  2. Start the scheduler and window orchestration.
  3. Observe batch/job creation and request completion through apply-result handler.
- **Outputs:** Evidence rows with l1/l2/l3 populated; window status updated to complete (if defined).
- **Verification:** Manual or automated check that all evidence rows have non-null `l3_abstracted_content`.
- **Risks/Assumptions:** Scheduler is already running (per project guardrail) and provider keys are configured.
- **Confidence:** 0.50

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- Should stage progression be window-service responsibility or orchestrator responsibility?
- Do we want `applyResult` and `requeue` in a single handler registry, or two separate registries?
- Is the refactor-everything “stage workflow” model intended to replace BaseOrchestrator long-term?

---

## Appendix: Sources

- packages/engine/convex/domain/orchestrator/base.ts
- packages/engine/convex/domain/orchestrator/target_registry.ts
- packages/engine/convex/domain/orchestrator/scheduler.ts
- packages/engine/convex/domain/llm_calls/llm_job_service.ts
- packages/engine/convex/domain/llm_calls/llm_batch_service.ts
- packages/engine/convex/domain/window/window_service.ts
- packages/engine/convex/domain/window/window_orchestrator.ts
- packages/engine/convex/domain/window/window_repo.ts
- packages/engine/convex/domain/window/evidence_search.ts
- refactor-everything:packages/engine/convex/domain/evidence/workflows/evidence_collect.ts
- refactor-everything:packages/engine/convex/domain/runs/workflows/runs_scheduler.ts
