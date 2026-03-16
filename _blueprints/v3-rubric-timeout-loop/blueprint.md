# Blueprint: V3 Rubric Critic Timeout Reset Loop

> The current V3 full pass has already crossed from “slow but progressing” into “scientifically invalid and operationally stuck.” The highest-value next move is not more waiting and not a large research expansion. It is to terminate the current cohort, patch the semantic gap that leaves exhausted nonterminal stages in `running`, patch timeout observability, then relaunch and decide whether a second performance-focused patch is still needed.
>
> This document is a prebuilt implementation plan. Each step is intended to be executable by an agent without re-deriving the core diagnosis.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop`
- **Research Question:** Given the current V3 full-pass evidence, do we have enough confidence to terminate the scientifically invalid cohort, what minimal patches should be applied before the next reset/relaunch, and is a deeper research pass materially useful versus direct implementation?
- **Scope:** current V3 full-pass failure, terminal policy, timeout observability, reset-loop readiness, one follow-on performance investigation lane if needed
- **Non-goals:** long-horizon architecture rewrite, new scoring semantics, broad Convex platform research beyond immediate operational constraints
- **Constraints:** do not implement code in this blueprint; preserve existing forensics; prefer smallest change set that restores autonomous loop operability

---

## 1. Worldview Register

`worldview.json` is the single source of truth for assignments, evidence, hypotheses, null challenges, and certainty scores for this blueprint run.

---

## 2. Evidence Ledger

- `k_001`: local code shows the count is correct and the semantic gap is missing terminalization for partially failed nonterminal stages. See [k_001_stage_policy_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_001_stage_policy_evidence.md).
- `k_002`: the current cohort is already scientifically invalid, with exhausted non-pending rubric-critic targets and no evidence of parser-led recovery. See [k_002_live_failure_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_002_live_failure_evidence.md).
- `k_003`: official Convex docs reinforce smaller, indexed, granular mutation work and do not suggest a different immediate fix class. See [k_003_convex_constraints_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_003_convex_constraints_evidence.md).
- `k_004`: the completion split is real, but it currently tracks experiment family rather than proving score-stage causality. See [k_004_family_split_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_004_family_split_evidence.md).

Critical gaps:

- The exact hot path inside the repeated `applyRequestResult` / `handleRequestError` / `reconcileRunStage` timeout trio is still not line-level profiled.
- The current evidence is sufficient to patch semantics first, but not sufficient to prove whether prompt complexity, target cardinality, or hot-document contention is the primary upstream timeout driver.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Run-state semantics and terminal policy | `Poincare` | `k_001` |
| A_02 | Live telemetry and cohort invalidity | `Boyle` | `k_002`, `k_004` |
| A_03 | Convex runtime constraints and design implications | `Laplace` | `k_003` |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| `h_A_01_001` | The primary product bug is missing terminalization for nonterminal exhausted stages. | `k_001`, `k_002` | `0.88` |
| `h_A_02_001` | The current cohort can be terminated now without losing essential engineering evidence. | `k_002`, `k_003` | `0.86` |
| `h_A_03_001` | A larger deep-search pass is unlikely to change the immediate patch order. | `k_001`, `k_003`, `k_004` | `0.82` |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| `h_A_01_001` | Passed | `k_001`, `k_002` |
| `h_A_02_001` | Passed | `k_002`, `k_003` |
| `h_A_03_001` | Passed | `k_001`, `k_003` |

Null-challenge artifact: [nc_h_v3_timeout_loop_challenge.json](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/null_challenges/nc_h_v3_timeout_loop_challenge.json)

---

## 6. Certainty Summary

- **Method:** isolated certainty scorer reviewed evidence and proposed steps without collecting new evidence.
- **Report:** [certainty_report.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/certainty/certainty_report.md)
- **Lowest-confidence items:** precise hot path inside the timeout trio, and whether an operator heal/requeue surface should exist at all.

---

## 7. Decision

### Kill Now?

Yes.

The current cohort should be terminated for engineering purposes before the next reset/relaunch. Evidence `k_002` shows the invalid runs are already exhausted and non-pending, not merely lagging. The null challenge failed to disprove that waiting longer is unlikely to restore scientific validity.

### Is More Deep Research Worth It First?

Not as a gating step.

This compact blueprint was worth doing because it forced a falsification and certainty pass. A larger deep-search run is unlikely to alter the immediate plan. The remaining unknowns are implementation-local, not strategy-level.

### Is the `120` vs `600` Split Real?

Yes, but treat it as a correlation, not yet as the mechanism.

The completed runs all belong to the families whose `score_target_total` resolves to `120`, while the stuck runs are the families that would later create `600` score targets. However, the observed stall still happens at `rubric_critic`, before score generation begins for the failed runs. Evidence `k_004` supports treating this as an experiment-family or prompt-complexity correlation until proven otherwise.

---

## 8. Prebuilt Implementation Plan

### S1: Terminate the Current Invalid Cohort

- **Objective:** stop spending cycles on a scientifically invalid pass that has no internal recovery path for the stuck runs.
- **Evidence to Review:** `k_002`, `k_003`
- **Inputs:** current forensics, current control-plane state
- **Actions:**
  1. Confirm the iteration snapshot/report remain intact and are committed or preserved locally.
  2. Mark the current pass as intentionally terminated in campaign bookkeeping.
  3. Reset the cohort only after the patch branch is ready.
- **Outputs:** terminated cohort, preserved forensic history, no ambiguity about whether the current results are usable
- **Verification:** no further analysis treats the current cohort as scientifically valid; reset starts from clean state
- **Risks/Assumptions:** assumes no one needs additional row-level examples from the still-running invalid cohort
- **Confidence:** `0.87`

### S2: Patch Timeout Classification

- **Objective:** make timeout-heavy failures visible as their own class instead of blending into `unknown`
- **Evidence to Review:** `k_001`, `k_002`
- **Inputs:** request error classifier and related diagnostics surfaces
- **Actions:**
  1. Patch request error classification to catch `timed out` and related timeout strings in addition to `timeout`.
  2. Update any reporting/tests that depend on the classifier labels.
  3. Document the improved observability in the Convex README if behavior or operator interpretation changes.
- **Outputs:** clearer timeout diagnosis in logs, stuck-work, and future forensics
- **Verification:** unit or targeted test shows `Your request timed out.` is classified as timeout-related; next failure sample is labeled correctly
- **Risks/Assumptions:** low-risk change; does not itself fix the semantic loop bug
- **Confidence:** `0.94`

### S3: Patch Nonterminal Exhausted-Stage Terminalization

- **Objective:** prevent runs from remaining `running` when the current nonterminal stage has exhausted failures and no pending work
- **Evidence to Review:** `k_001`, `k_002`
- **Inputs:** `maybeAdvanceRunStage`, run reconciliation tests, status/reporting surfaces
- **Actions:**
  1. Add an explicit branch so nonterminal stages with `failed > 0 && !hasPending` transition to a terminal state instead of remaining `running`.
  2. Prefer an existing terminal state such as `error` unless there is a compelling downstream reason not to.
  3. Update tests so the engine no longer accepts `29 completed / 1 failed / 0 pending` as a running state.
  4. Update any operator docs that interpret these runs.
- **Outputs:** deterministic terminalization of scientifically invalid exhausted-stage runs
- **Verification:** reproduced failure family moves to terminal state and is surfaced consistently by control-plane status
- **Risks/Assumptions:** downstream consumers may rely on `running` vs `error`; audit targeted reports before merging
- **Confidence:** `0.85`

### S4: Relaunch One Full Iteration After Semantic Fixes

- **Objective:** verify that the loop becomes operationally honest before optimizing deeper runtime behavior
- **Evidence to Review:** `k_002`, `k_004`
- **Inputs:** validated patch branch, reset/start control plane, campaign manifest
- **Actions:**
  1. Reset the cohort from clean state.
  2. Launch the full `n=30`, `pause_after=null` cohort.
  3. Monitor until one of three conditions occurs:
     - all runs complete,
     - some runs terminalize cleanly as `error`,
     - the timeout trio persists without semantic ambiguity.
  4. Record whether the `120` vs `600` family split remains.
- **Outputs:** a new iteration that proves whether the semantic fix alone is enough
- **Verification:** no scientifically invalid run remains indefinitely `running` with no pending work
- **Risks/Assumptions:** upstream timeout pressure may still exist after semantic fixes
- **Confidence:** `0.83`

### S5: If Needed, Narrow the Timeout-Heavy Path

- **Objective:** reduce the chance that `applyRequestResult`, `handleRequestError`, or `reconcileRunStage` time out under larger experiment families
- **Evidence to Review:** `k_003`, `k_004`
- **Inputs:** live timeout logs from the relaunch, code for progress computation and request-target refresh
- **Actions:**
  1. Profile the timeout trio using line-level logging or narrower instrumentation.
  2. Check whether `.collect()` or broad run-level reads are still happening in the final-target path.
  3. Split any expensive run-level recomputation into smaller indexed or scheduled internal mutations.
  4. Re-test on the experiment families that currently correlate with failure.
- **Outputs:** targeted performance patch rather than speculative refactor
- **Verification:** reduced timeout incidence on previously failing families; no new read-budget regressions
- **Risks/Assumptions:** the root cause may be contention or prompt/provider latency rather than one obvious broad scan
- **Confidence:** `0.76`

### S6: Decide Whether a Heal Surface Is Product Policy or Scope Creep

- **Objective:** avoid building a requeue/heal surface by accident when fail-fast reset semantics may be enough
- **Evidence to Review:** `k_001`, `k_003`
- **Inputs:** desired operator workflow, campaign philosophy
- **Actions:**
  1. Decide explicitly whether exhausted nonterminal targets should ever be manually resumed.
  2. If yes, design a narrow heal/requeue surface that operates only on exhausted target rows.
  3. If no, codify fail-fast/reset as the supported policy and keep the surface area smaller.
- **Outputs:** explicit product stance on exhausted target recovery
- **Verification:** operator documentation and control-plane behavior match the chosen policy
- **Risks/Assumptions:** adding a heal surface may create new ambiguous mid-state behavior
- **Confidence:** `0.71`

---

## 9. Validation Gates

1. **Truthfulness Gate:** the engine must not leave scientifically invalid exhausted-stage runs in `running`.
2. **Observability Gate:** timeout-led failures are labeled distinctly enough to diagnose without raw log spelunking.
3. **Loop Gate:** after reset/relaunch, the system either completes or fails terminally without agentic interpretation of hidden mid-states.
4. **Family-Split Gate:** explicitly check whether the current `120` vs `600` family correlation persists after the semantic fixes.

---

## 10. Open Questions

- Is `error` the correct terminal state for partially failed nonterminal stages, or does reporting need a more specialized terminal status?
- If the `120` vs `600` split persists after terminalization, is the next best discriminator bundle size, prompt content family, or hot-document contention?
- Do we want one targeted row-level profiler or trace event around reconciliation before the next relaunch, or only if timeouts persist after S2 and S3?

---

## Appendix: Sources

- [k_001_stage_policy_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_001_stage_policy_evidence.md)
- [k_002_live_failure_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_002_live_failure_evidence.md)
- [k_003_convex_constraints_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_003_convex_constraints_evidence.md)
- [k_004_family_split_evidence.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/knowledge/k_004_family_split_evidence.md)
- [nc_h_v3_timeout_loop_challenge.json](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/null_challenges/nc_h_v3_timeout_loop_challenge.json)
- [certainty_report.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-rubric-timeout-loop/certainty/certainty_report.md)
