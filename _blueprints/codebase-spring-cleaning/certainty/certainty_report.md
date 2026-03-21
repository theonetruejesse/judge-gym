# Certainty Report: Codebase Spring Cleaning

Date: 2026-03-20

This report assigns confidence scores (0.0–1.0) with brief rationales for:
- (a) knowledge entries `k_001..k_004`
- (b) each micro-hypothesis under `hypotheses/`
- (c) implementation steps `S1..S8` (as provided in the request)

Scoring rubric:
- Higher score: strongly supported by current repo state + falsification pass, low ambiguity, low risk of hidden coupling.
- Lower score: speculative, depends on product decisions, or has meaningful implementation risk/unknown blast radius.

---

## A) Knowledge Entry Scores

- `k_001_package_ownership_and_dead_code`: **0.86**
  - Strong support: points at concrete, mostly-unreferenced Convex provider execution modules and prompt duplication after Temporal cutover.
  - Minor uncertainty: hidden operator flows could exist, but falsification indicates no non-test call sites.

- `k_002_service_repo_and_module_boundaries`: **0.83**
  - Strong support: module naming/role drift is obvious from file responsibilities (read aggregation vs persistence vs pure logic).
  - Minor uncertainty: the “best” naming scheme is subjective and may trade off against performance locality.

- `k_003_settings_and_shared_contract_ownership`: **0.80**
  - Strong support: `engine-settings` is a mixed “kitchen sink” and there is visible drift pressure via duplicated tuples/zod/types.
  - Uncertainty: which package should be the canonical runtime validator owner depends on workflow bundle constraints.

- `k_004_runtime_semantics_and_pre_pilot_cleanup`: **0.90**
  - Very strong support: the run partial-failure semantics mismatch is a correctness issue, not style.
  - Strong support that activity scope/timeout is a real scale risk (though exact severity depends on pilot workload).

---

## B) Hypothesis Scores

- `h_A_01_001_remove_dead_provider_execution`: **0.90**
  - Falsification: Passed (no non-test call sites).
  - Risk: low if registry types are preserved and execution actions are removed carefully.

- `h_A_01_002_defer_run_prompt_migration`: **0.74**
  - Falsification: Mixed (prompt rendering is coupled to Convex domain logic).
  - This is a pragmatic sequencing claim; still some risk that prompt ownership drift continues.

- `h_A_02_001_normalize_repo_service_naming`: **0.84**
  - Falsification: Passed.
  - Mostly mechanical refactor/rename/split; risk is moderate due to wide imports and path churn.

- `h_A_02_002_split_pool_and_bundle_ownership`: **0.76**
  - Falsification: indirectly supported by the same drift evidence; not explicitly challenged.
  - Value depends on how much the domain continues to expand; could be over-splitting if not.

- `h_A_03_001_split_engine_settings_package`: **0.78**
  - Falsification: Mixed (splitting is justified; “prompts must move out” is not strictly required).
  - Should be done carefully to avoid import churn; subpath exports can keep ergonomics.

- `h_A_03_002_centralize_runtime_validators`: **0.74**
  - Strong motivation: duplication and drift.
  - Main risk: centralizing Zod validators can accidentally pull runtime deps into Temporal workflow bundles; may need “zod validators in Convex/worker only; TS contracts in workflow”.

- `h_A_04_001_fix_partial_failure_progression`: **0.89**
  - Falsification: Passed. This is a semantics/correctness mismatch.
  - Complexity risk is real (skip/fail propagation needs careful accounting), but the need is high.

- `h_A_04_002_reduce_activity_scope_and_timeout_risk`: **0.73**
  - Plausible scale risk; severity depends on pilot stage sizes and provider latency distributions.
  - Some mitigations are cheap (raise timeouts) while others are structural (partition stage activities).

---

## C) Step Scores (S1–S8)

- `S1` Remove dead Convex provider execution + duplicate window prompt copy (keep shared registry intact): **0.90**
  - Supported by `k_001` + falsification Pass 1 (unreachable in runtime).
  - Low risk if provider/model registry stays where the schemas and worker API need it.

- `S2` Normalize run-domain naming/boundaries (experiments_data, bundle plan modules, pools vs experiments ownership): **0.82**
  - Supported by `k_002`; mostly structural hygiene.
  - Risk: moderate due to wide call surface and potential import churn.

- `S3` Split engine-settings into real settings schema + contracts/env submodules: **0.78**
  - Supported by `k_003`; needs careful public API/subpath export design to avoid import noise.

- `S4` Centralize runtime validators/enum tuples to eliminate duplicated zod/literal definitions: **0.74**
  - Supported by `k_003`; worthwhile but needs a “workflow-safe” plan (avoid pulling Zod into workflow bundle unless you intend to).

- `S5` Fix run partial-failure progression and downstream skip/fail propagation: **0.86**
  - Supported by `k_004` + falsification; correctness issue and likely pilot blocker at scale.
  - Main risk is subtle accounting/edge cases, not whether it’s needed.

- `S6` Add explicit window/pool readiness-or-failure semantics for partially transformed evidence: **0.67**
  - Directionally helpful (clarifies what evidence is eligible for pools/bundling), but depends on product semantics.
  - Might be folded into a later “evidence pipeline” redesign if you go that direction.

- `S7` Reduce Temporal stage-activity timeout risk and add pilot-scale tests: **0.74**
  - Timeout risk is credible; tests are clearly valuable.
  - Exact refactor needed depends on pilot workload sizes; could start with timeouts + a pilot-scale test before partitioning.

- `S8` Reframe analysis export ownership and naming without breaking the Python client: **0.72**
  - Falsification suggests Convex export surface is necessary (data lives in Convex; Python already consumes it).
  - Renaming/ownership clarity is worthwhile but high risk of client breakage if not kept compatible.

---

## Copy-Paste Summary (Worldview-Friendly)

### Evidence
- k_001: 0.86
- k_002: 0.83
- k_003: 0.80
- k_004: 0.90

### Hypotheses
- h_A_01_001: 0.90
- h_A_01_002: 0.74
- h_A_02_001: 0.84
- h_A_02_002: 0.76
- h_A_03_001: 0.78
- h_A_03_002: 0.74
- h_A_04_001: 0.89
- h_A_04_002: 0.73

### Steps
- S1: 0.90
- S2: 0.82
- S3: 0.78
- S4: 0.74
- S5: 0.86
- S6: 0.67
- S7: 0.74
- S8: 0.72

