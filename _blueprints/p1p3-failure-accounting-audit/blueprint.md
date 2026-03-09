# Blueprint: P1/P3 failure accounting audit

> This audit answers a narrow pre-launch question: which table nulls and historical partial failures are expected semantics, which ones are true failures, and what must be checked or fixed before launching the final `illiberal democracy` plus make-up batch.
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/p1p3-failure-accounting-audit
- **Research Question:** Audit historical run failure accounting across samples, sample_evidence_scores, scores, score_critics, process_request_targets, and telemetry surfaces. Determine which null fields are expected schema semantics vs true failures, whether partial-failure runs were correctly accounted for, whether there are additional latent bugs before launching the final illiberal-democracy plus make-up batch, and what exact pre-launch checks we should require. Use Convex data, code semantics, and telemetry/observability evidence.
- **Scope:** representative clean and partial runs on the dev deployment; canonical score/rubric artifact semantics; Convex table truth; local observability mirror; Axiom corroboration.
- **Non-goals:** implementing fixes, changing schemas, starting runs, or proving correctness for every historical run ever created.
- **Constraints:** no code changes in this pass; Convex dev deployment only; Axiom token lacks monitor access; local mirror is intentionally capped and lossy.

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

- `k_001` — modern subset-scoring semantics: score truth lives on `sample_evidence_scores`, not `samples`. See `knowledge/k_001_subset_score_semantics.md`.
- `k_002` — clean D1 run proves sample-level score nulls can coexist with full unit-level completion. See `knowledge/k_002_clean_d1_table_truth.md`.
- `k_003` — partial D1 run rooted in `3` exhausted rubric targets and `30` blocked downstream score units. See `knowledge/k_003_partial_d1_failure_shape.md`.
- `k_004` — partial P1 run is dominated by score-gen parse failure, not rubric failure or scheduler silence. See `knowledge/k_004_partial_p1_parse_dominance.md`.
- `k_005` — observability surfaces are useful but semantically noisy: capped local mirror, synthesized trace refs, historical error over-reporting, and Axiom-as-corroboration only. See `knowledge/k_005_observability_alignment_gaps.md`.
- Critical gap: no exhaustive audit of legacy or mixed-mode runs that predate `sample_evidence_scores`.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_01 | Schema and artifact semantics for sample/unit score storage | `Peirce` | `k_001`, `k_002` |
| A_02 | Historical Convex table truth on representative runs | `Lead-Local` | `k_002`, `k_003`, `k_004` |
| A_03 | Convex observability alignment and operator-surface semantics | `Sartre` | `k_005` |
| A_04 | Axiom telemetry corroboration and blind spots | `Bacon` | `k_005` |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| `h_A_01_001` | Sample-level score nulls are expected on current subset runs and are not themselves a failure signal. | `k_001`, `k_002` | 0.96 |
| `h_A_02_001` | Terminal artifact accounting is mostly right on the reviewed runs, but telemetry surfaces over-report historical retry/error noise. | `k_003`, `k_004`, `k_005` | 0.88 |
| `h_A_03_001` | Parser/output fragility in score generation is the dominant remaining execution risk, with telemetry/OCC noise secondary. | `k_004`, `k_005` | 0.90 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| `h_A_01_001` | Passed | No counterexample found; clean D1 run strongly supports it. |
| `h_A_02_001` | Mixed | Telemetry drift is broader than one surface; some stage-event semantics remain unresolved. |
| `h_A_03_001` | Mixed leaning Passed | Scheduler/autonomy risk is not zero, but historical misses are still parse-dominated. |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and steps.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** stage-event payload semantics versus artifact truth; legacy/mixed-mode runs; scheduler/autonomy as a secondary risk; thin Axiom `request_error` payloads.

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

### Steps

#### S1: Lock the canonical failure-accounting map

- **Objective:** Stop reading the wrong tables before any further launch planning or debugging.
- **Evidence to Review:** `k_001`, `k_002`
- **Inputs:** `packages/engine/convex/models/samples.ts`, `packages/engine/convex/domain/runs/run_service.ts`, `packages/engine/convex/domain/runs/run_progress.ts`
- **Actions:**
  1. Adopt the following audit truth map for modern subset runs:
     - rubric completion → `samples.rubric_id`, `rubrics`
     - rubric critic completion → `samples.rubric_critic_id`, `rubric_critics`
     - score completion → `sample_evidence_scores.score_id`, `scores`
     - score critic completion → `sample_evidence_scores.score_critic_id`, `score_critics`
  2. Treat `samples.score_id` and `samples.score_critic_id` as legacy/fallback-only fields unless `sample_evidence_scores` are absent.
  3. Update the operator launch checklist and any ad hoc audit notebooks/scripts to use that map.
- **Outputs:** a single canonical “table truth” reference used by every subsequent audit.
- **Verification:** a clean subset run such as `kh77e0h2fp5pmr9geaf5q9myh982gecn` must be classified fully complete even though all sample-level score pointers are null.
- **Risks/Assumptions:** legacy runs without `sample_evidence_scores` still need explicit fallback handling.
- **Confidence:** 0.94

#### S2: Run a representative deficit census before the next batch

- **Objective:** Prove that every planned make-up run addresses a real deficit and characterize its root cause.
- **Evidence to Review:** `k_002`, `k_003`, `k_004`
- **Inputs:** target experiment/run ledger; Convex MCP access to `samples`, `sample_evidence_scores`, `scores`, `score_critics`, `llm_requests`, `process_request_targets`
- **Actions:**
  1. For every incomplete experiment targeted for supplementation, compute:
     - `samples.length`
     - expected score-unit cardinality = `samples.length × pool_size`
     - completed score units = non-null `sample_evidence_scores.score_id`
     - completed score critics = non-null `sample_evidence_scores.score_critic_id`
     - exhausted root targets by stage from `process_request_targets`
  2. Split deficits into:
     - exhausted root failures,
     - blocked downstream misses,
     - historical retry/error noise with terminal success.
  3. Record one-line deficit statements per run before queueing any make-up batch.
- **Outputs:** a make-up ledger that is tied to table truth rather than manual table impressions.
- **Verification:** partial D1 should reconcile to `3` exhausted rubric roots and `30` blocked score units; partial P1 should reconcile to `300` exhausted score-gen units with parse-dominated error history.
- **Risks/Assumptions:** representative runs suggest the right method, but other historical runs may have different failure topology.
- **Confidence:** 0.89

#### S3: Fix operator-surface semantics before trusting live health gates

- **Objective:** Make health/debug surfaces distinguish historical retry noise from terminal failure.
- **Evidence to Review:** `k_003`, `k_005`
- **Inputs:** `packages/engine/convex/domain/maintenance/codex.ts`, `packages/engine/convex/packages/lab.ts`, `packages/engine/convex/domain/telemetry/emit.ts`, `packages/engine/convex/domain/telemetry/events.ts`
- **Actions:**
  1. Change `getProcessHealth.error_summary` to either:
     - count exhausted targets only, or
     - expose separate `historical_error_summary` and `terminal_failure_summary`.
  2. Change `getRunDiagnostics.failed_requests` to clearly separate historical error attempts from still-failed terminal targets.
  3. Persist `external_trace_ref` in `process_observability` instead of synthesizing it only at read time.
  4. Clarify or refine `request_state_meta.approximate` so settled runs do not look more uncertain than they are.
- **Outputs:** operator surfaces that can be used as launch gates without conflating retries with failures.
- **Verification:** a clean run such as `kh77e0h2fp5pmr9geaf5q9myh982gecn` should show no terminal failures while still preserving optional historical-attempt detail.
- **Risks/Assumptions:** stage-event payload semantics may need deeper tracing before every observability inconsistency can be normalized.
- **Confidence:** 0.84

#### S4: Address parser/output fragility before the final relaunch

- **Objective:** Reduce the dominant historical failure mode seen in the bad `P1` run.
- **Evidence to Review:** `k_004`, `k_005`
- **Inputs:** score-generation parser and prompt/response contract; representative bad run `kh765a6z2njwef2cp5y4cavxbd82k2z3`
- **Actions:**
  1. Audit the top parse failures by exact message and malformed output family.
  2. Decide whether to harden via prompt contract changes, parser tolerance, or both.
  3. Re-run a tiny canary under the same models/settings most exposed to score-gen parse failure.
  4. Confirm that telemetry/OCC tails do not mask parser outcomes during the canary.
- **Outputs:** a parser-hardening decision and a canary result that directly tests the historical failure family.
- **Verification:** the canary should complete score-gen without the recurring `Missing reasoning before VERDICT line` class.
- **Risks/Assumptions:** parser-hardening can reduce but may not eliminate malformed model output.
- **Confidence:** 0.82

#### S5: Define the strict prelaunch gate for the illiberal + make-up batch

- **Objective:** Launch only when table truth, telemetry semantics, and external corroboration agree closely enough.
- **Evidence to Review:** `k_001`, `k_003`, `k_004`, `k_005`
- **Inputs:** final candidate experiments, make-up targets, Convex MCP, Axiom MCP
- **Actions:**
  1. Require zero ambiguity on artifact truth:
     - correct pool size,
     - expected sample and score-unit cardinality,
     - no unexplained nulls in canonical completion fields.
  2. Require operator-surface sanity:
     - no actionable stuck work,
     - no active backlog without transport,
     - health surfaces interpretable without historical-error confusion.
  3. Require Axiom corroboration:
     - run/window trace export present,
     - stage counts align with artifact truth on canary runs.
  4. Only after those gates pass, create/start the final illiberal-democracy plus make-up batch.
- **Outputs:** a strict go/no-go launch gate tied to the actual audited failure classes.
- **Verification:** a small relaunch canary should reconcile across artifact tables, run summary, health surfaces, and Axiom stage counts.
- **Risks/Assumptions:** Axiom remains a corroboration surface, not the primary state store.
- **Confidence:** 0.91

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- Do any historical legacy runs still rely on sample-level score fields enough to require mixed-mode reporting logic in operator tooling?
- Which exact mutation-time counters back every `run_stage_advanced` payload, and where do those payload semantics still drift from artifact truth?
- What is the best parser-hardening strategy for score generation: prompt tightening, parser tolerance, or a post-processor?
- Should Axiom `request_error` payloads and local mirror event export be expanded before the final batch, or is terminal artifact truth sufficient for this pass?

---

## Appendix: Sources

- `knowledge/k_001_subset_score_semantics.md`
- `knowledge/k_002_clean_d1_table_truth.md`
- `knowledge/k_003_partial_d1_failure_shape.md`
- `knowledge/k_004_partial_p1_parse_dominance.md`
- `knowledge/k_005_observability_alignment_gaps.md`
- `null_challenges/nc_failure_accounting_core_challenge.json`
- `certainty/certainty_report.md`
