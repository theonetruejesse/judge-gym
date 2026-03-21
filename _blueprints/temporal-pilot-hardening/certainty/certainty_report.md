# Certainty Report: Temporal Pilot Hardening

Date: 2026-03-20

This report assigns confidence scores (0.0–1.0) to:
- Evidence entries `k_001`–`k_005`
- The most important hypotheses in `_blueprints/temporal-pilot-hardening/hypotheses/`
- The implementation steps `S1`–`S8` in [blueprint.md](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-pilot-hardening/blueprint.md)

Scores reflect: (1) how directly supported the claim is by current repo state and primary sources, (2) how much the null challenge weakened the claim, and (3) how likely the step/hypothesis is to be required for the next pilot loop versus “nice to have”.

---

## Evidence Scores

- `k_001` (Pilot loop redesign + matrix drift): **0.86**
  - Strong: grounded in local campaign manifest/state + the current V3 ablation doc and the already-shipped Temporal-native stuck reasons.
  - Remaining uncertainty: whether the next pilot aims for engine-hardening only vs scientific replication.

- `k_002` (Observability + agent loop gaps): **0.80**
  - Strong: directly grounded in current code surfaces (`process_debug`, workflow controls) and clear missing pieces (task-queue health, stronger Temporal truth path, bounded repair).
  - Weakened by null challenge: task-queue signals are approximate; should not be a single hard gate.

- `k_003` (Window decomposition: raw vs semantic views): **0.68**
  - Mixed: the current schema limitation is real, but the “must decompose before pilot” implication is partially speculative and was explicitly weakened by the null challenge.
  - High confidence as a medium-term refactor; medium confidence as an immediate blocker.

- `k_004` (Lifecycle semantics: pause/resume/cancel/repair): **0.82**
  - Strong: grounded in shipped workflow code and current Convex surfaces (missing cancel, stubbed repairBounded, window pause_after not exposed).
  - Uncertainty: how much must move into workflow vs remain a Convex-side control wrapper.

- `k_005` (Pilot readiness/hardening: smoke, task-queue checks, cohort read-budget, Redis): **0.84**
  - Strong: aligns with known historical failure mode (status/read limits) and current infra reality (Redis quota store is correctness-critical; smoke tests are still manual).
  - Uncertainty: exact shape of the polling check (CLI vs API vs worker heartbeat).

---

## Hypothesis Scores

Pilot scope + control-plane alignment:

- `h_A_01_001` (Manifest/matrix alignment for scientific intent): **0.74**
  - Correct for scientific alignment.
  - Not strictly required for an engine-hardening pilot if validity labeling is explicit (null challenge).

- `h_A_01_002` (Temporal readiness gate via pollers): **0.62**
  - Still useful as a signal.
  - Weakened by null challenge: pollers/backlog are time-windowed/approximate and can false-negative under saturation.

- `h_A_01_003` (Temporal-native safe-heal semantics): **0.83**
  - Very likely correct and required: the old queue-era “transport repair” mental model is obsolete and actively harmful to diagnosis.

Observability + agent operability:

- `h_A_02_001` (Task queue health surface is needed): **0.73**
  - Needed for fast infra triage, but should be treated as diagnostic, not sole truth.

- `h_A_02_002` (Temporal-first truth stack + repair gates): **0.79**
  - High leverage and matches the falsification findings: rely on Update receipts / workflow queries for confirmation rather than only Convex mirrors.

- `h_A_02_003` (Allowlisted repairBounded operations): **0.71**
  - Likely valuable and low risk if narrowly scoped; exact operation set needs care.

Evidence/window pipeline:

- `h_A_03_001` (Split collection from semantic views): **0.66**
  - Correct direction; not mandatory for pilot v0 correctness loop (null challenge).

- `h_A_03_002` (Bundle plans should reference pipeline id): **0.63**
  - Similar: scientifically hygienic; can be deferred if the next pilot isn’t varying semantic pipelines yet.

Lifecycle controls:

- `h_A_04_001` (Idempotent control updates + stable cmdId semantics): **0.77**
  - Strongly aligned with agent retry/replay realities.
  - The “immediate projection” part is weaker and can be treated as ergonomic (null challenge).

- `h_A_04_002` (Window pause_after=collect gate): **0.57**
  - Useful, but explicitly called deferrable by falsification; potentially wasted effort if schema decomposition is imminent.

- `h_A_04_003` (Explicit cancel + bounded repair ops are needed): **0.76**
  - For an autonomous loop, not having cancel is operationally expensive (resets become the only stop).

Pilot hardening:

- `h_A_05_001` (Automated e2e smoke + worker polling check): **0.82**
  - Very likely required to run large loops without manual babysitting.

- `h_A_05_002` (Cohort-scoped status/read-budgeted): **0.72**
  - Real at full cohort scale; could be deferred if the next loop is a tiny canary only.

- `h_A_05_003` (Redis as required infra for pilot mode): **0.78**
  - Given quota enforcement is Redis-backed, missing Redis is a hard failure mode; the only uncertainty is whether quota enforcement is optional for the pilot.

---

## Step Scores (Blueprint S1–S8)

- `S1` Decide the next pilot contract: **0.90**
  - Unavoidable. You need to choose correctness-only vs scientific-alignment to avoid ambiguous “done” criteria.

- `S2` Add a Temporal-native pilot observability surface: **0.83**
  - High leverage; reduces the most common false diagnoses (“stuck” vs “no workers” vs “stale projection”).
  - Should avoid treating task-queue stats as a single hard gate.

- `S3` Finish the control contract for pilot operation: **0.82**
  - Explicit cancel + allowlisted repair + stable cmdId semantics are core to an agent loop.
  - “Immediate projection on every update” is optional; keep Temporal receipts as the primary confirmation path.

- `S4` Build automated end-to-end smoke coverage: **0.86**
  - Very likely the fastest way to prevent regressions before a cohort launch.

- `S5` Replace `v3-finish-pass` with a Temporal-native pilot loop: **0.77**
  - Needed if you want the autonomous loop again.
  - Can be phased: first add the new observability/control surfaces, then refit the skill.

- `S6` Make cohort status cheap enough for the full matrix: **0.70**
  - Necessary for the “full matrix” goal; possibly overkill for a small canary.

- `S7` Treat Redis as required pilot infrastructure: **0.78**
  - If quota enforcement is on, Redis is a correctness dependency and should fail fast + classify cleanly.

- `S8` Defer or pull forward evidence-pipeline redesign: **0.61**
  - Correct medium-term direction, but not a pilot v0 blocker unless the next loop needs multiple semantic pipelines / pipeline-specific bundle clustering.

---

## Highest-Confidence “Do Next” Set

If you want maximum momentum with minimal speculative refactor:
- `S1`, `S2`, `S3`, `S4` first
- then `S6` if the next run is truly full-matrix
- then `S5` to reintroduce the automated finish-pass loop on the new surfaces

`S8` only moves earlier if the next pilot explicitly needs pipeline variants for scientific comparability.

