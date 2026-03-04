# Blueprint: Synthetic Window Scaffolding Final Test Plan

This plan defines the remaining reliability tests to run with low-sample synthetic data before moving to evidence flow rollout. It is execution-ready and prioritized for fast feedback with bounded risk.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/synthetic-window-scaffolding-final-test-plan`
- **Research Question:** Using low-sample synthetic setup in packages/engine, what remaining tests are required to validate window/run orchestration reliability before evidence flow rollout, and in what order should they be executed?
- **Scope:** Window and run orchestration reliability, retry/failure behavior, scheduler behavior, observability and safe recovery under synthetic load.
- **Non-goals:** Provider quality benchmarking, prompt quality tuning, analysis package statistical outputs.
- **Constraints:** Keep samples low, use synthetic setup, avoid expensive live-provider loops until gates pass.

---

## 1. Evidence Ledger

- `k_001`: Scheduler caps and stage advancement semantics from source code.
- `k_002`: Retry lifecycle and row-additive request behavior.
- `k_003`: Codex diagnostics and auto-heal coverage.
- `k_004`: Synthetic harness capabilities already present in repo.
- `k_005`: Convex limit-aware guidance (bounded/paginated reads).
- `k_006`: Prior baseline and fault-injection observations.

Primary source files:
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/orchestrator/scheduler.ts`
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_batch_service.ts`
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/codex.ts`
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts`

External references:
- https://docs.convex.dev/production/state/limits
- https://docs.convex.dev/database/reading-data/indexes/
- https://docs.convex.dev/understanding/best-practices

---

## 2. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Scheduler/backpressure/stage transitions | Singer | k_001 |
| A_02 | Retry semantics and request row churn | Ohm | k_002 |
| A_03 | Telemetry/health/heal observability | Hume | k_003 |
| A_04 | Synthetic harness and routing boundaries | Descartes | k_004, k_006 |
| A_05 | Convex limit-aware diagnostics safety | Lead | k_005 |

---

## 3. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_01_001 | Bounded scheduler dispatch can look like stalling under burst load while still being correct. | k_001 | 0.77 |
| h_A_02_001 | Rate-limit deferrals can create prolonged pending churn without consuming retry attempts. | k_002 | 0.66 |
| h_A_03_001 | Fallback health summaries can hide approximation from callers. | k_003 | 0.61 |
| h_A_04_001 | Remaining risk is concentrated at route boundaries (job/batch/mixed continuation). | k_004, k_006 | 0.84 |
| h_A_05_001 | Bounded/paginated diagnostics are mandatory under fanout to keep observability reliable. | k_003, k_005 | 0.80 |

---

## 4. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_01_001 | Unclear | Bounded caps are proven; queue-age quantification still missing. |
| h_A_02_001 | Passed | Deferral path does not increment attempts. |
| h_A_03_001 | Passed | Approximation internal in fallback; not exposed in health schema. |
| h_A_04_001 | Failed | Boundary-risk dominance not yet fully proven by existing matrix. |
| h_A_05_001 | Passed | Core diagnostics are bounded; some broad collects remain. |

Details: `null_challenges/*.json`.

---

## 5. Finalized Implementation Plan (Research Output)

### S1: Define the synthetic reliability matrix and invariants

- **Objective:** Freeze exact test scenarios so each run is comparable.
- **Evidence to Review:** `k_001`, `k_002`, `k_004`.
- **Inputs:** `settings.ts` route threshold, current debug scripts, prior baselines.
- **Actions:**
  1. Define 4 route scenarios: `job_only`, `boundary_near_threshold`, `batch_only`, `mixed_continuation`.
  2. Define 3 fault modes: `none`, `post_provider_parse_fail(20%)`, `rate_limit_deferral`.
  3. Define pass/fail invariants for each scenario.
- **Outputs:** Matrix table checked into docs with scenario IDs.
- **Verification:** Every scenario has explicit start params, expected route mix, and expected terminal conditions.
- **Risks/Assumptions:** Matrix must stay small enough to run repeatedly.
- **Confidence:** 0.90.

### S2: Add a temporary synthetic runner script in `packages/engine/scripts/`

- **Objective:** Standardize low-cost setup and avoid manual operator drift.
- **Evidence to Review:** `k_004`.
- **Inputs:** Existing `debug:*` script patterns and `lab`/internal APIs.
- **Actions:**
  1. Add a temp script that creates window/run test fixtures with deterministic sample counts.
  2. Add optional fault-injection args for parse-fail ratio and limiter mode.
  3. Emit run metadata (window_id/run_id/trace_id/scenario_id).
- **Outputs:** Reusable temp script and short usage doc.
- **Verification:** Two consecutive invocations with same seed produce same scenario metadata and expected route choice.
- **Risks/Assumptions:** Temp script remains isolated and easy to remove.
- **Confidence:** 0.84.

### S3: Execute core route matrix (no faults) with low samples

- **Objective:** Confirm baseline correctness across route boundaries.
- **Evidence to Review:** `k_001`, `k_004`, `k_006`.
- **Inputs:** Clean tables, matrix from S1, temp runner from S2.
- **Actions:**
  1. Run `job_only` and `batch_only` scenarios concurrently.
  2. Run `boundary_near_threshold` where count is just below/above `min_batch_size`.
  3. Collect telemetry via `debug:analyze`, `debug:watch`, `debug:tail`.
- **Outputs:** Scenario result log with route distribution and completion metrics.
- **Verification:** `events_after_terminal = 0`, `duplicate_apply_success = 0`, all processes complete.
- **Risks/Assumptions:** Scheduler caps may increase latency; not a failure unless invariants are violated.
- **Confidence:** 0.82.

### S4: Execute forced parse-failure matrix

- **Objective:** Validate retry caps and partial continuation behavior.
- **Evidence to Review:** `k_002`, `k_004`, `k_006`.
- **Inputs:** Fault injection at 20% and 50% parse failure.
- **Actions:**
  1. Run batch-capable scenario with 20% injection and verify partial continuation.
  2. Run stress scenario with 50% injection to confirm clean terminalization.
  3. Confirm failed attempts persist as rows and retries create fresh rows.
- **Outputs:** Error-mode telemetry snapshots and request lifecycle summary.
- **Verification:** Retry count respects policy caps; no infinite pending; completion/failure status is final and coherent.
- **Risks/Assumptions:** Parser-failure simulation must be isolated to temp test path.
- **Confidence:** 0.81.

### S5: Execute recovery matrix with safe heal actions

- **Objective:** Prove live-debug loop can recover injected stuck conditions safely.
- **Evidence to Review:** `k_003`.
- **Inputs:** `debug:stuck`, `debug:heal` dry-run/apply.
- **Actions:**
  1. Intentionally create orphan/stale scenarios in synthetic runs.
  2. Run `debug:heal` dry-run and validate planned actions.
  3. Apply heal and confirm process resumes or terminalizes correctly.
- **Outputs:** Recovery transcript per scenario.
- **Verification:** Recovery succeeds without manual data mutation; action list is constrained to safe codex actions.
- **Risks/Assumptions:** Some corner cases may still require investigation if not recoverable.
- **Confidence:** 0.78.

### S6: Execute limit-proximity diagnostics checks

- **Objective:** Confirm observability functions remain safe under telemetry volume.
- **Evidence to Review:** `k_003`, `k_005`.
- **Inputs:** High-event synthetic scenario, paginated analysis params.
- **Actions:**
  1. Run high-event synthetic scenario (still low provider cost).
  2. Exercise `debug:analyze` with capped `max-events` and paginated reads.
  3. Exercise `getProcessHealth` and `getStuckWork` during load.
- **Outputs:** Diagnostics performance and safety report.
- **Verification:** No Convex read-limit failures; bounded queries complete consistently.
- **Risks/Assumptions:** Some broad scan paths may need tightening if load increases further.
- **Confidence:** 0.73.

### S7: Rollout gate before evidence flow

- **Objective:** Decide if system is ready for evidence-flow re-entry.
- **Evidence to Review:** S3-S6 artifacts plus certainty report.
- **Inputs:** Scenario pass/fail dashboard and traces.
- **Actions:**
  1. Declare gate criteria: all critical invariants pass in two consecutive full matrix runs.
  2. Run one controlled canary with real evidence flow.
  3. Keep rollback trigger: disable injections, nuke affected process tables only, rerun baseline synthetic checks.
- **Outputs:** Go/No-Go decision record.
- **Verification:** Gate criteria met and canary matches expected telemetry profile.
- **Risks/Assumptions:** Canary introduces provider variance; acceptable only after synthetic matrix stability.
- **Confidence:** 0.78.

---

## 6. Validation Gates

1. **Evidence Sufficiency Gate:** every step maps to `k_...` evidence.
2. **Falsification Gate:** failed/unclear hypotheses are reflected in test design (especially h_A_01_001 and h_A_04_001).
3. **Telemetry Invariant Gate:** `events_after_terminal=0`, no seq gaps, no duplicate apply success.
4. **Recovery Gate:** safe auto-heal handles synthetic stuck scenarios without manual row surgery.
5. **Rollout Gate:** two consecutive full synthetic matrix passes before evidence flow rollout.

---

## 7. Open Questions

- Should rate-limit deferrals gain a max-deferral cap or age-based escalation rule?
- Should `getProcessHealth` expose approximation mode in API response for operators?
- Should `getStuckWork` broad scans be paginated/index-constrained before next scale-up?

---

## Appendix: Artifacts

- `knowledge/`
- `hypotheses/`
- `null_challenges/`
- `certainty/certainty_report.md`
- `worldview.json`
