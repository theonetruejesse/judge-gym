# Blueprint: Temporal Pilot Hardening

> Pre-pilot hardening plan for judge-gym after the Temporal cutover. The goal is to make a full-scale Temporal-backed pilot debugging loop viable again, redesign the old `v3-finish-pass` assumptions around the new runtime, and decide which larger refactors are required now versus deferrable until after the first correctness-focused pilot pass.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-pilot-hardening`
- **Research Question:** What refactors and observability/control-plane changes are needed before judge-gym can run a full-scale Temporal-backed pilot debugging loop, including redesign of the old `v3-finish-pass` flow, end-to-end Temporal observability, improved start/stop functionality, and possible window/raw-process decomposition for evidence collection and semantic cleaning?
- **Scope:** research and plan only; no implementation in this pass.
- **Constraint:** keep the first next loop focused on proving end-to-end correctness and operability, not on prematurely redesigning every data model.

---

## 1. Executive Read

The core Temporal migration is already done. The blocking work before the next full pilot is now mostly **control-plane hardening, observability, and pilot-scope clarification**, not another execution-runtime rewrite. Evidence: `k_001`, `k_002`, `k_004`, `k_005`.

The most important correction from the null challenge is prioritization:

- **Mandatory before a full matrix pilot:** Temporal-aware observability, bounded repair semantics, scripted end-to-end smoke, and a cohort-scoped status path that stays under Convex read budgets. Evidence: `k_002`, `k_004`, `k_005`, `nc_pass1_001`.
- **Mandatory for scientific alignment, not for engine correctness:** update the old V3 manifest/control loop so it matches the corrected `c1`-`c7` story or explicitly labels validity if it keeps the legacy 22-tag cohort. Evidence: `k_001`, `nc_pass1_001`.
- **Useful but deferrable for pilot v0:** full window/raw-process decomposition, immediate Convex projection on every control update, and `window pause_after='collect'` as a first-class gate. Evidence: `k_003`, `k_004`, `nc_pass1_001`.

So the right next move is **not** “rewrite windows first.” The right next move is:

1. make the Temporal-backed system observable and controllable enough for an agent loop,
2. make the pilot cohort/status surfaces honest and cheap,
3. add automated smoke coverage,
4. then decide whether the next pilot is an **engine-hardening pilot** or a **scientifically aligned corrected-matrix pilot**.

---

## 2. Evidence Ledger

- `k_001`: the old `v3-finish-pass` assumptions are stale because execution truth is now Temporal, and the current V3 campaign manifest is out of sync with the corrected `c1`-`c7` follow-up matrix.
- `k_002`: the agent still lacks first-class Temporal task-queue health, a unified Temporal truth surface, and a real bounded repair primitive.
- `k_003`: the current window/evidence schema couples raw evidence and one semantic pipeline too tightly for future model-specific cleaning, stable bundle-plan comparability, and collection-versus-transform gating.
- `k_004`: lifecycle controls exist but are incomplete for pilot automation: window `pause_after` is not exposed, `repairBounded` is stubbed, cancel is missing, and control updates do not immediately refresh the Convex mirror.
- `k_005`: before a full pilot loop, the repo still needs automated end-to-end smoke coverage, cohort-scoped status under read budgets, and Railway Redis treated as required pilot infrastructure.
- `nc_pass1_001`: the hardening plan survives falsification, but several attractive refactors are not mandatory for pilot v0. In particular, task-queue health should be treated as an approximate diagnostic signal rather than a single hard gate, and the window decomposition can be deferred if the immediate goal is runtime correctness instead of scientific surface redesign.

---

## 3. Worldview Summary

### What is actually blocking the next pilot

1. **Observability blind spots**
   - no first-class task-queue poller/backlog view
   - no unified Temporal-truth read path in the same operator surface
   - repair still mostly means “start or resume from Convex”
   - Axiom is helpful when it works, but the system needs to stay debuggable even when Axiom is unavailable
   - Evidence: `k_002`, `k_004`, `k_005`

2. **Control-plane incompleteness**
   - no explicit cancel
   - `repairBounded` is stubbed
   - window control is behind run control
   - control idempotency is not strong enough for repeated agent retries
   - Evidence: `k_004`

3. **Pilot-scope ambiguity**
   - old `v3_finish_pass` manifest still encodes the legacy 22-tag cohort
   - current V3 write-up says corrected `c1`-`c7` families are the scientifically valid follow-up surface
   - we need to choose whether the next loop is a correctness pilot, a corrected-matrix pilot, or a smaller new pilot
   - Evidence: `k_001`, `nc_pass1_001`

4. **Status/read-budget risk**
   - historical V3 loop already hit status-path read-limit failures
   - the next cohort monitor must stay cohort-scoped and cheap
   - Evidence: `k_001`, `k_005`, `nc_pass1_001`

### What is probably next-wave work

1. Splitting windows into raw collection versus semantic pipelines/views
2. Storing bundle plans against pipeline identity, not only `l2`/`l3`
3. Window `pause_after='collect'`
4. Immediate projection on every control update

These are directionally right, but the null challenge says they are **not required to prove the first next pilot loop works end to end**. Evidence: `k_003`, `k_004`, `nc_pass1_001`.

---

## 4. Active Micro-Hypotheses

- `h_A_01_001`: the legacy V3 manifest should be updated or replaced before claiming scientific alignment with the corrected matrix. Confidence `0.75`. Evidence: `k_001`.
- `h_A_01_002`: the pilot loop needs Temporal readiness as a distinct infra signal, but not as a single hard gate. Confidence `0.72`, weakened by null challenge. Evidence: `k_001`, `k_002`, `nc_pass1_001`.
- `h_A_01_003`: safe-heal should be redefined around Temporal-native execution repair rather than queue-era transport semantics. Confidence `0.78`. Evidence: `k_001`.
- `h_A_02_001`: the agent loop needs a task-queue health surface. Confidence `0.78`, but it should be treated as approximate. Evidence: `k_002`, `nc_pass1_001`.
- `h_A_02_002`: mutating repairs should confirm Temporal truth first, then rely on update receipts rather than only Convex projection. Confidence `0.72`. Evidence: `k_002`.
- `h_A_02_003`: a small allowlisted `repairBounded` surface will materially simplify the loop. Confidence `0.66`. Evidence: `k_002`.
- `h_A_03_001`: raw collection and semantic views should become separate first-class layers. Confidence `0.75`, but deferrable for pilot v0. Evidence: `k_003`, `nc_pass1_001`.
- `h_A_03_002`: bundle plans should reference pipeline identity. Confidence `0.70`, also deferrable until scientific-surface redesign. Evidence: `k_003`.
- `h_A_04_001`: control updates need stable `cmdId` semantics and a stronger acknowledgement model. Confidence `0.78`. Evidence: `k_004`.
- `h_A_04_002`: `window pause_after='collect'` is high leverage but not a hard blocker. Confidence `0.70`, weakened by null challenge. Evidence: `k_004`, `nc_pass1_001`.
- `h_A_04_003`: explicit cancel and small bounded repair ops are needed before a full automated loop. Confidence `0.73`. Evidence: `k_004`.
- `h_A_05_001`: the repo needs an automated window+run smoke plus worker-polling checks. Confidence `0.78`. Evidence: `k_005`.
- `h_A_05_002`: the next campaign status path must stay cohort-scoped and read-budgeted. Confidence `0.73`. Evidence: `k_005`, `nc_pass1_001`.
- `h_A_05_003`: Redis should be treated as required pilot infra. Confidence `0.70`. Evidence: `k_005`.

---

## 5. Null Challenge Summary

`nc_pass1_001` narrowed the plan in useful ways:

- **Matrix/manifest alignment**
  - required for scientific interpretation
  - not required for a pure engine-hardening pilot

- **Task-queue readiness**
  - should exist as a signal
  - should not be the only hard gate because poller/backlog signals are approximate

- **Window decomposition**
  - clearly useful
  - not the first blocker for pilot correctness

- **Immediate Convex projection on updates**
  - ergonomically useful
  - not required if the automation truth stack is Temporal-first

- **Window pause-after**
  - useful gate
  - can be deferred if the collection/transform split is about to happen anyway

---

## 6. Implementation Plan

### S1. Decide the next pilot contract

- **Goal:** explicitly choose between:
  - `engine_hardening_pilot`
  - `corrected_matrix_pilot`
  - `new_canary_subset`
- **Why:** the old V3 manifest and the current V3 write-up no longer describe the same experimental surface. Evidence: `k_001`, `nc_pass1_001`
- **Deliverables:**
  - a new campaign manifest or pilot spec
  - explicit scientific-validity labels for any legacy families kept for runtime-only testing
- **Verification:** a reviewer can answer “which experiments are in the next loop, and are they scientifically interpretable?” without inference.

### S2. Add a Temporal-native pilot observability surface

- **Goal:** expose the Temporal facts the agent cannot currently answer quickly.
- **Must include:**
  - task-queue pollers
  - approximate backlog/backlog age
  - a direct workflow-truth read path that complements `process_observability`
- **Why:** current Convex surfaces are good for triage but not enough for confident autonomous repair. Evidence: `k_002`, `k_005`
- **Verification:**
  - the agent can tell the difference between “workflow stale” and “no workers polling”
  - the agent can confirm a workflow’s real state without relying on UI

### S3. Finish the control contract for pilot operation

- **Goal:** make lifecycle operations explicit, idempotent, and auditable.
- **Must include:**
  - stable `cmdId` semantics for mutating controls
  - explicit cancel
  - a small allowlisted `repairBounded`
  - clear repair truth stack: Temporal confirm first, Convex projection second
- **Should probably defer:** immediate projection on every control update unless it proves necessary after smoke testing. Evidence: `k_004`, `nc_pass1_001`
- **Verification:**
  - repeated agent retries do not create ambiguous control state
  - cancel/resume/repair results are acknowledged and explainable

### S4. Build automated end-to-end smoke coverage

- **Goal:** make the basic Railway + Convex + worker path testable without human UI inspection.
- **Must include:**
  - tiny window smoke
  - tiny run smoke
  - worker-polling/task-queue check
- **Why:** this is the fastest way to catch infra or binding regressions before a cohort launch. Evidence: `k_005`
- **Verification:** one command can prove the system can create, bind, execute, and persist artifacts for both windows and runs.

### S5. Replace the old `v3-finish-pass` assumptions with a Temporal-native pilot loop

- **Goal:** redesign the old skill/control-plane loop around:
  - Temporal-owned execution truth
  - Temporal-native stuck reasons
  - bounded repair only
  - stronger validity labeling
- **Must change:**
  - failure taxonomy
  - readiness checks
  - iteration snapshot fields
  - safe-heal semantics
- **Why:** the current skill still encodes too much queue-era worldview. Evidence: `k_001`, `k_002`, `k_004`
- **Verification:** the loop can explain a stalled cohort in Temporal-era terms without inventing dead transport concepts.

### S6. Make cohort status cheap enough for the full matrix

- **Goal:** keep campaign monitoring under Convex read budgets at full pilot size.
- **Must include:**
  - cohort-only enumeration
  - bounded process-health inputs
  - no table-wide or target-wide hot scans in normal status calls
- **Why:** this failed before and can fail again even with Temporal if the status path is careless. Evidence: `k_005`, `nc_pass1_001`
- **Verification:** status calls remain fast and bounded on a hot cohort.

### S7. Treat Redis as required pilot infrastructure

- **Goal:** stop treating quota infrastructure as optional for pilot mode.
- **Must include:**
  - required Redis envs in pilot setup
  - clear failure classification for quota-store outages versus provider denials
- **Why:** the quota store is now correctness-critical for worker execution. Evidence: `k_005`
- **Verification:** a missing or broken Redis path fails clearly and diagnostically.

### S8. Defer or explicitly pull forward the evidence-pipeline redesign

- **Default recommendation:** defer the full window/raw-process split until after the first correctness-focused pilot loop.
- **Pull it forward only if:**
  - the next pilot must be scientifically aligned with multiple semantic-view variants, or
  - you want collection-versus-transform gating as part of the immediate experimental method
- **If pulled forward, do all of:**
  - separate raw evidence collection from semantic views
  - make pipeline identity first-class
  - make bundle plans reference pipeline identity
- **Why:** this is the right longer-term model, but it is not the first blocker according to the null challenge. Evidence: `k_003`, `nc_pass1_001`
- **Verification:** evidence provenance is explicit enough to support corrected clustering/bundle comparisons without schema ambiguity.

---

## 7. Priority Order

If the objective is **“get the next pilot debugging loop running as fast as possible”**, do this order:

1. `S1` pilot contract decision
2. `S2` Temporal observability surface
3. `S3` control contract completion
4. `S4` automated smoke
5. `S6` cohort-scoped status budget
6. `S5` rewrite `v3-finish-pass` around the new surfaces
7. `S7` Redis pilot-mode hardening
8. `S8` evidence-pipeline redesign only if still needed

If the objective is **“make the next pilot scientifically aligned with the corrected V3 story”**, then pull `S8` forward right after `S1`.

---

## 8. Open Questions

- Is the next loop primarily an **engine-hardening** loop or a **scientific corrected-matrix** loop?
- Do we want a new campaign id instead of mutating `v3_finish_pass` in place?
- Should task-queue health be surfaced through Convex, a Railway-side ops service, or directly in the agent tooling?
- Do we want `window pause_after='collect'` as a bridge feature, or do we want to skip it and move straight to a separate semantic-pipeline process?
- How much of the Axiom dependency should be considered optional versus required for pilot forensics?

---

## 9. Exit Criteria For “Pilot Ready”

The system is ready for the next full pilot debugging loop when:

1. a reviewer can state the exact pilot cohort and its scientific-validity status,
2. the agent can inspect Temporal truth and queue health without the UI,
3. cancel/resume/repair semantics are explicit and idempotent enough for retries,
4. one scripted smoke proves window and run execution end to end,
5. campaign status stays bounded under expected cohort size,
6. Redis/worker/Temporal infra failures show up as their own class of problem instead of looking like engine bugs.

At that point, the remaining work is no longer “finish the Temporal migration.” It becomes “run the next pilot loop and iterate on the failures it actually reveals.”
