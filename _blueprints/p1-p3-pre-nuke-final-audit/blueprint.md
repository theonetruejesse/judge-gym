# Blueprint: P1/P3 Pre-Nuke Final Audit

> This is the final save-state blueprint for the current Convex/Axiom instance before destructive cleanup or migration to a fresh deployment.
>
> The current experiment outputs are no longer reusable for evaluation because a score-critic prompting bug was discovered outside this audit. This blueprint therefore treats the instance as a forensic systems corpus: it captures what is now known about parse failures, observability gaps, telemetry contention, scheduler contention, and what must be fixed before rebuilding and rerunning experiments.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/p1-p3-pre-nuke-final-audit`
- **Research Question:** Comprehensive final pre-nuke audit of the current judge-gym system state: identify all material bugs and hotspots surfaced from the current Convex/Axiom instance, with emphasis on parse failures, observability gaps, telemetry contention, scheduler OCC, and what must be fixed before rebuilding experiments on a fresh deployment.
- **Scope:** parse-failure corpus, observability truth surfaces, telemetry/OCC hotspots, scheduler kickoff contention, persisted aggregate integrity, experiment shortfall distribution.
- **Non-goals:** re-validating the externally discovered score-critic prompt bug itself; implementing code changes in this research pass; launching any new experiments or runs.
- **Constraints:** use current live Convex/Axiom data without destructive mutation; keep the result actionable enough to guide a fresh-instance rebuild.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` is the registry for assignments, evidence files, hypotheses, challenge output, and certainty scores.

- **Registry Path:** `worldview.json`
- **Evidence Registry:** `knowledge/k_001_parse_failure_corpus.md`, `knowledge/k_002_observability_surface_mismatches.md`, `knowledge/k_003_telemetry_occ_hotspots.md`, `knowledge/k_004_persisted_counter_integrity.md`, `knowledge/k_005_experiment_shortfalls_by_model.md`
- **Hypotheses Registry:** `hypotheses/hyp_A_01_001_parse_contract_hotspot.json`, `hypotheses/hyp_A_02_001_observability_distortion.json`, `hypotheses/hyp_A_03_001_process_observability_hot_row.json`, `hypotheses/hyp_A_03_002_scheduler_occ_weakened.json`, `hypotheses/hyp_A_04_001_persisted_counters_clean.json`
- **Null Challenge:** `null_challenges/nc_pre_nuke_final_audit.json`
- **Certainty Report:** `certainty/certainty_report.md`

---

## 2. Current State Summary

- **System state:** no active stuck work was present during the audit; bounded health/heal surfaces are working well enough to inspect the system safely. See `knowledge/k_003_telemetry_occ_hotspots.md`, `knowledge/k_004_persisted_counter_integrity.md`.
- **Experiment state:** the current dataset contains `18` experiments and `18` runs. The most severe shortfalls cluster on `gpt-5.2-chat`, which accounts for `60` missing samples across `2` catastrophic runs. See `knowledge/k_005_experiment_shortfalls_by_model.md`.
- **Data integrity state:** the new persisted counters are clean on the audited dataset. They are no longer a blocker. See `knowledge/k_004_persisted_counter_integrity.md`.
- **Primary bug classes:** parse-failure contract issues, raw-output observability loss, terminal-truth vs history confusion in diagnostics, `process_observability` hot-row OCC pressure, and a weaker but real scheduler kickoff race. See `knowledge/k_001_parse_failure_corpus.md`, `knowledge/k_002_observability_surface_mismatches.md`, `knowledge/k_003_telemetry_occ_hotspots.md`.
- **Operational conclusion:** this instance should now be treated as a frozen forensic archive, not a source of valid experiment outputs.

---

## 3. Evidence Ledger

- **`k_001` Parse failure corpus**
  - Establishes the dominant failure clusters by model and stage.
  - Confirms `gpt-5.2-chat` is the main `score_gen` hotspot and that no-fit / empty-verdict outputs are a major failure mode.
- **`k_002` Observability surface mismatches**
  - Shows that clean completed runs still surface historical failure residue.
  - Confirms raw failed outputs are generally not durably preserved where operators need them.
- **`k_003` Telemetry/OCC hotspots**
  - Shows `process_observability` is the dominant telemetry hot row.
  - Shows scheduler OCC is real but likely a duplicate-start race rather than the current blocker.
- **`k_004` Persisted counter integrity**
  - Removes aggregate drift as a current blocker.
- **`k_005` Experiment shortfalls by model**
  - Narrows the primary model-specific risk surface to `gpt-5.2-chat`.

No critical evidence gaps remain for deciding the next fix program. The remaining uncertainty is concentrated in exact design choices, not in whether the bug classes are real.

---

## 4. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Parse-failure corpus by model/stage and surviving forensic data | Planck | `k_001`, `k_005` |
| A_02 | Observability truth surfaces vs terminal truth | Raman | `k_002` |
| A_03 | Telemetry/OCC hotspots and scheduler contention | Poincare | `k_003` |
| A_04 | Persisted aggregate integrity | Codex | `k_004` |

---

## 5. Stable Bug Ledger

### Confirmed must-fix bugs

1. **Parse-failure raw output loss**
   - Failed parse requests usually do not preserve raw model output on `llm_requests`.
   - This blocks post-hoc forensic debugging. See `k_001`, `k_002`.

2. **Observability semantics distortion**
   - `getRunDiagnostics` exposes historical failed attempts without separating them from terminal failed targets.
   - `getProcessHealth.error_summary` still shows residual historical errors on clean completed runs. See `k_002`.

3. **Local telemetry mirror discards too much context**
   - `process_observability` drops `payload_json`, stores `external_trace_ref` as `null`, and caps recent events too aggressively for forensics. See `k_002`, `k_003`.

4. **`process_observability` hot-row contention**
   - Mirroring too many events into one row creates the dominant live OCC hotspot. See `k_003`.

5. **Subset score-gen contract weakness**
   - Current no-abstain subset scoring does not cleanly represent “no matching rubric stage,” causing repeated empty-verdict / `None` parse failures. See `k_001`.

6. **`gpt-5.2-chat` instability on current score-gen contract**
   - The worst failures cluster heavily on this model variant, so it should be treated as the primary rerun risk lane. See `k_001`, `k_005`.

### Confirmed but lower-priority bugs

7. **Scheduler kickoff race**
   - `startScheduler` has a non-atomic duplicate-start race.
   - The race is real; the claim that it is non-blocking is weaker than the rest of the bug list. See `k_003`, `null_challenges/nc_pre_nuke_final_audit.json`.

### Explicitly closed / not current blockers

8. **Persisted aggregate drift**
   - Not supported by current evidence. See `k_004`.

9. **Active stuck-work / scheduler outage**
   - Not supported by current evidence. See `k_003`.

---

## 6. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| `h_A_01_001` | The dominant current parse-failure class is a `score_gen` contract mismatch concentrated in `gpt-5.2-chat`. | `k_001`, `k_005` | 0.94 |
| `h_A_02_001` | Current operator surfaces conflate historical failed attempts with terminal failure and are insufficient for parse forensics. | `k_002` | 0.96 |
| `h_A_03_001` | `process_observability` is the dominant live telemetry hot row. | `k_003` | 0.92 |
| `h_A_03_002` | `startScheduler` OCC is likely duplicate-start contention, but “not a blocker” is only a weakened inference. | `k_003` | 0.84 |
| `h_A_04_001` | Persisted counters are currently clean on the audited dev dataset. | `k_004` | 0.97 |

---

## 7. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| `h_A_01_001` | Passed | Schema can store `assistant_output`, but sampled failed requests still had none. |
| `h_A_02_001` | Passed | `getProcessHealth` is more target-oriented than raw request history, but still leaves clean runs looking noisy. |
| `h_A_03_001` | Passed | Other historical hotspots exist, but `process_observability` remains the strongest recurring OCC cluster. |
| `h_A_03_002` | Weakened | The race is real; “not a blocker” is an inference from current clean state rather than a formal proof. |
| `h_A_04_001` | Passed | Exact recomputation found zero drift. |

See `null_challenges/nc_pre_nuke_final_audit.json`.

---

## 8. Certainty Scoring Summary

- **Method:** isolated certainty scorer over the final evidence set.
- **Report:** `certainty/certainty_report.md`
- **Highest-confidence conclusions:** persist raw output on parse failure (0.98), separate terminal vs historical failure reporting (0.95), persisted-counter integrity is clean (0.97).
- **Lowest-confidence conclusion:** scheduler OCC is likely duplicate-start contention and probably not the current blocker (0.84).

---

## 9. Prebuilt Implementation Plan

This is the fix program to execute before rebuilding experiments on a fresh or cleaned deployment.

### S1: Preserve the forensic corpus before destructive reset

- **Objective:** keep this instance useful as an incident archive while freeing the next environment to be clean.
- **Evidence to Review:** `k_001`, `k_002`, `k_003`, `k_005`
- **Inputs:** current Convex deployment, Axiom dataset, this blueprint bundle
- **Actions:**
  1. Freeze this blueprint bundle as the save state for the current instance.
  2. Preserve the current deployment or snapshot the tables needed for forensics: `experiments`, `runs`, `samples`, `sample_evidence_scores`, `llm_requests`, `process_request_targets`, `process_observability`, `rubrics`, `rubric_critics`, `scores`, `score_critics`.
  3. Preserve the associated Axiom trace access for later incident comparison.
- **Outputs:** a recoverable forensic archive separate from the new clean experiment environment.
- **Verification:** audit bundle exists; retained dataset list is explicit; destructive reset plan does not depend on the current instance for future experiment truth.
- **Risks/Assumptions:** assumes retaining this instance is cheaper than attempting to salvage any current experiment outputs.
- **Confidence:** 0.95

### S2: Persist raw parse-failure payloads before retries and error handling

- **Objective:** make parse failures actually debuggable after the fact.
- **Evidence to Review:** `k_001`, `k_002`
- **Inputs:** `packages/engine/convex/domain/runs/run_service.ts`, `packages/engine/convex/domain/window/window_service.ts`, `packages/engine/convex/models/llm_calls.ts`
- **Actions:**
  1. Patch the failed-request path so raw output and any useful reasoning/provider identifiers are stored on parse failure, not only on success.
  2. Preserve a bounded but useful preview in diagnostics even if full output retention is capped.
  3. Ensure both run and window paths behave consistently.
- **Outputs:** failed parse requests retain enough payload to reconstruct the failure.
- **Verification:** a forced parse-failure test retains raw output on the durable request row; diagnostics can show a bounded preview.
- **Risks/Assumptions:** storage growth must be bounded; prompt caching/system prompt deduplication may be needed later to offset added retention.
- **Confidence:** 0.98

### S3: Separate terminal truth from historical attempt history in operator surfaces

- **Objective:** stop clean completed runs from looking failed.
- **Evidence to Review:** `k_002`
- **Inputs:** `packages/engine/convex/packages/lab.ts`, `packages/engine/convex/domain/maintenance/codex.ts`, `packages/engine/convex/domain/llm_calls/llm_request_repo.ts`, `packages/engine/convex/domain/runs/run_progress.ts`
- **Actions:**
  1. Define terminal-failure semantics at the target/stage level.
  2. Keep historical failed attempts available, but expose them as separate forensic history rather than as current failure truth.
  3. Align `getRunDiagnostics` and `getProcessHealth` with the same terminal truth model.
- **Outputs:** operator surfaces distinguish terminal failed targets from historical failed attempts.
- **Verification:** clean completed runs show zero terminal failures while still exposing historical attempts in a separate section/field.
- **Risks/Assumptions:** existing consumers may rely on current fields; additive rather than breaking changes are safer.
- **Confidence:** 0.95

### S4: Improve local telemetry fidelity without keeping the hot row design

- **Objective:** preserve enough local telemetry to debug without relying exclusively on Axiom.
- **Evidence to Review:** `k_002`, `k_003`
- **Inputs:** `packages/engine/convex/domain/telemetry/emit.ts`, `packages/engine/convex/domain/telemetry/events.ts`, `packages/engine/convex/domain/maintenance/codex.ts`
- **Actions:**
  1. Persist `external_trace_ref` on the local row rather than synthesizing it on read.
  2. Preserve a minimal but informative payload for parse and error events in the local mirror.
  3. Revisit the recent-event cap or store detailed events separately from process milestone state.
- **Outputs:** better local watch/debug fidelity and explicit Axiom linkage.
- **Verification:** a parse failure leaves a local row with persisted trace ref and meaningful bounded payload.
- **Risks/Assumptions:** the fix must not worsen hot-row contention.
- **Confidence:** 0.91

### S5: Reduce `process_observability` write pressure

- **Objective:** eliminate the dominant recurring telemetry OCC hotspot.
- **Evidence to Review:** `k_003`
- **Inputs:** `packages/engine/convex/domain/telemetry/events.ts`, `packages/engine/convex/domain/telemetry/emit.ts`, run/window emit call sites
- **Actions:**
  1. Reduce `shouldMirrorLocally` fanout so not every batch/job/scheduler/error event rewrites the same hot row.
  2. Stop rebuilding/sorting the same `recent_events` array on every mirrored event, or move recent-event logs off the hot row.
  3. Keep process milestone fields separate from verbose event history if necessary.
- **Outputs:** materially lower OCC pressure on `process_observability`.
- **Verification:** repeat load test shows a large drop in `recordProcessObservability` OCC retries.
- **Risks/Assumptions:** some contention may remain unavoidable if milestone writes stay highly concurrent.
- **Confidence:** 0.90

### S6: Tighten the subset `score_gen` prompt/parser contract

- **Objective:** stop repeated no-fit / empty-verdict failures, especially on `gpt-5.2-chat`.
- **Evidence to Review:** `k_001`, `k_005`
- **Inputs:** `packages/engine/convex/domain/runs/run_strategies.ts`, `packages/engine/convex/domain/runs/run_parsers.ts`, current scoring prompts
- **Actions:**
  1. Decide how “no matching rubric stage” should be represented: explicit token, abstain-like path, or parser-tolerated empty-match contract.
  2. Update the prompt contract and parser together.
  3. Re-run small targeted samples on `gpt-5.2-chat` and `gpt-4.1-mini` before any large batch.
- **Outputs:** an unambiguous, testable score-gen contract for no-fit cases.
- **Verification:** targeted smoke tests stop producing `Missing reasoning before VERDICT line`, `Unrecognized verdict label: None`, and empty `VERDICT:` on the revised contract.
- **Risks/Assumptions:** prompt-only fixes may not eliminate all model-specific behavior; parser tolerance may still be necessary.
- **Confidence:** 0.89

### S7: Make scheduler kickoff idempotent under contention

- **Objective:** remove the known duplicate-start race before the next heavy load.
- **Evidence to Review:** `k_003`, `null_challenges/nc_pre_nuke_final_audit.json`
- **Inputs:** `packages/engine/convex/domain/orchestrator/scheduler.ts`
- **Actions:**
  1. Replace the non-atomic scheduled-function scan plus `runAfter` kickoff with an idempotent gate/lock.
  2. Validate that repeated concurrent kickoff attempts do not multiply scheduled work.
- **Outputs:** lower `startScheduler` OCC and less ambiguity around scheduler races.
- **Verification:** concurrent kickoff tests no longer produce recurring `startScheduler` OCC under normal load.
- **Risks/Assumptions:** this is lower urgency than the observability and parse fixes, but it should be done before the next full-capacity rerun.
- **Confidence:** 0.84

### S8: Rebuild on a fresh instance only after a strict validation gate

- **Objective:** avoid contaminating the next batch with the same blind spots.
- **Evidence to Review:** `k_001`, `k_002`, `k_003`, `k_004`, `k_005`
- **Inputs:** fresh Convex deployment, revised prompts/parsers, revised telemetry surfaces
- **Actions:**
  1. Stand up a fresh deployment or clean instance after the fix set above lands.
  2. Run targeted smoke tests for parse-failure retention, terminal-vs-history reporting, telemetry fidelity, and scheduler kickoff idempotence.
  3. Only then re-create experiments and launch the next large batch.
- **Outputs:** clean environment with validated fixes before expensive reruns.
- **Verification:** targeted tests pass; parse failures are explainable; telemetry hot spots are reduced; no counter drift appears.
- **Risks/Assumptions:** assumes the score-critic prompt bug is fixed separately before the next experiment rebuild.
- **Confidence:** 0.93

---

## 10. Validation Gates

1. **Forensic Gate:** parse failures preserve raw output or a bounded preview on the durable request row.
2. **Truth Gate:** clean completed runs do not report terminal failures solely because of historical failed attempts.
3. **Telemetry Gate:** local debug surfaces preserve trace linkage and useful bounded payload without relying exclusively on Axiom.
4. **Hotspot Gate:** `process_observability` OCC materially drops under representative load.
5. **Scheduler Gate:** repeated kickoff attempts are idempotent under contention.
6. **Integrity Gate:** persisted aggregates still show zero drift on post-fix spot checks.

---

## 11. Open Questions

- What is the best no-fit representation for subset scoring: explicit token, abstain-like branch, or parser-tolerated empty match?
- How much failed raw output should be retained locally before request-row storage becomes too expensive?
- Should recent local telemetry history live outside `process_observability` entirely?
- Is it worth retaining a lightweight aggregate-integrity audit query as an ongoing maintenance check?

---

## Appendix: Key Live Facts Captured In This Audit

- `18` experiments, `18` runs, `484` samples, `9050` `sample_evidence_scores` in the audited dev dataset.
- Persisted counter drift check: `0` sample mismatches, `0` run mismatches, `0` experiment mismatches.
- Incomplete experiments by scoring model: `gpt-5.2-chat` `60`, `gpt-4.1-mini` `8`, `gpt-4.1` `8`, `gpt-5.2` `1`.
- Axiom 72h parse-error counts: `run/score_gen=1352`, `run/rubric_gen=58`, `run/rubric_critic=2`.
- Dominant catastrophic parse failures: `Missing reasoning before VERDICT line` on `gpt-5.2-chat`.
