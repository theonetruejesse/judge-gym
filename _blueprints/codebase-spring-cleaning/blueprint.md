# Blueprint: Codebase Spring Cleaning Before Next Pilot Wave

> Cleanup and ownership plan for judge-gym after the Temporal migration. The goal is to remove dead code, normalize ownership boundaries, streamline shared schemas/settings, and fix remaining runtime semantics before the next decomposition feature wave and full pilot loop.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/codebase-spring-cleaning`
- **Research Question:** What code-structure refinements, ownership clarifications, dead-code removals, settings/schema cleanups, and runtime-semantics checks should judge-gym complete before the next decomp feature wave and full end-to-end pilot loop?
- **Scope:** research and plan only; no implementation in this pass.
- **Constraint:** prioritize cleanup that improves code observability and pilot correctness before larger structural rewrites like full evidence-process decomposition.

---

## 1. Executive Read

The highest-value cleanup is **not** a broad rewrite. The codebase is already on the new Temporal runtime, so the next cleanup pass should focus on: (1) deleting dead Convex execution code, (2) normalizing module ownership and naming, (3) splitting `engine-settings` into real settings/contracts modules, and (4) fixing the remaining run partial-failure semantics bug before the next large pilot loop. Evidence: `k_001`, `k_002`, `k_003`, `k_004`.

Two findings dominate priority:

- **Dead or misleading ownership is real.** Convex still carries an old provider execution layer and duplicate prompt code, `engine-settings` is a kitchen-sink package rather than a settings package, and the `domain/runs` folder has misleading repo/service names that hide real responsibilities. Evidence: `k_001`, `k_002`, `k_003`.
- **Run partial-failure progression is still wrong for the intended pilot semantics.** Windows already continue with successful items, but runs still halt on any failed target. More importantly, downstream targets are not explicitly skipped or failed when an upstream prerequisite fails, so “29 succeed, 1 fail, continue” is not possible without a real semantics fix. Evidence: `k_004`.

The null challenge narrowed two tempting cleanup ideas:

- **Do not force full run-prompt migration in the spring-cleaning pass.** Window prompt duplication should be cleaned up now, but run prompt ownership is entangled with Convex-owned randomization and bundle logic, so moving it is a larger refactor than a simple cleanup step. Null outcome: mixed.
- **Do not over-rotate on “engine-settings must stop owning prompts” as the main objective.** The stronger need is to split the package and stop exposing prompts through the root index; whether prompts remain in a dedicated submodule or move fully to Temporal can be decided after the settings/contracts cleanup. Null outcome: mixed.

So the right order is:

1. remove dead execution code and duplicate prompt copies,
2. normalize ownership/naming in `domain/runs`,
3. split `engine-settings` and centralize shared validators,
4. fix run partial-failure semantics,
5. then decide if deeper prompt relocation or evidence-process decomposition still needs to move forward immediately.

---

## 2. Evidence Ledger

- `k_001`: package ownership and dead code after the Temporal cutover
- `k_002`: repo/service/module boundary drift in `domain/runs`
- `k_003`: `engine-settings` and shared contract ownership drift
- `k_004`: runtime semantics and pre-pilot cleanup, especially run partial-failure behavior
- `nc_pass1_hypothesis_falsification`: falsification pass that mostly confirmed the cleanup direction but weakened full run-prompt migration and “no prompts in engine-settings” as immediate requirements

---

## 3. Worldview Summary

### What should be cleaned now

1. **Delete dead Convex execution code**
   - Old Convex provider execution files (`provider_services`, `openai_batch`, `ai_chat`, likely `openai_chat`) no longer sit on the live path.
   - Keep only the shared provider/model registry until a better single-source-of-truth location is chosen.
   - Evidence: `k_001`

2. **Rename and split misleading run-domain modules**
   - `experiments_data.ts` is effectively a read-service / query-model layer.
   - `bundle_plan_logic.ts` is a materializer/strategy module, not vague “logic.”
   - `experiments_repo.ts` and `bundle_plan_repo.ts` mix aggregate persistence with orchestration.
   - Evidence: `k_002`

3. **Turn `engine-settings` into an actual settings/contracts package**
   - Root entry point should expose a real engine settings schema and defaults.
   - Contracts, env keys, quota shapes, and optional prompt helpers should live in dedicated submodules.
   - Duplicated runtime validators and enum tuples should be centralized.
   - Evidence: `k_003`

4. **Fix run partial-failure progression before the next big pilot**
   - The current engine cannot continue with successful run units once any target fully fails.
   - Downstream skip/fail propagation is missing.
   - Reporting already implies “completed with failures” semantics, so execution and reporting are out of sync.
   - Evidence: `k_004`

### What should probably be deferred

1. **Full run-prompt relocation out of Convex**
   - Worth doing eventually, but not a spring-cleaning-only change.
   - Evidence: `k_001`, `nc_pass1_hypothesis_falsification`

2. **Deep evidence-process decomposition**
   - Still useful, but not necessary to get the codebase clean and pilot-safe.
   - Evidence: `k_004` plus prior pilot-hardening work

3. **A full analysis export redesign**
   - The export surface likely should stay in Convex because the data lives there and the Python package consumes it already.
   - Cleanup should focus on naming and ownership clarity rather than moving it out immediately.
   - Evidence: `k_001`, `nc_pass1_hypothesis_falsification`

---

## 4. Active Micro-Hypotheses

- `h_A_01_001`: remove dead Convex provider execution, keep the shared registry
- `h_A_01_002`: defer full run-prompt migration; do window-prompt cleanup now
- `h_A_02_001`: normalize repo/service/materializer naming in `domain/runs`
- `h_A_02_002`: split pools and bundle-plan orchestration out of mixed repo files
- `h_A_03_001`: split `engine-settings` into settings schema + contracts/env submodules
- `h_A_03_002`: centralize runtime validators and enum tuples
- `h_A_04_001`: fix run partial-failure progression with downstream skip/fail propagation
- `h_A_04_002`: reduce stage-activity timeout risk and add pilot-scale tests

Null challenge summary:

- `h_A_01_001`, `h_A_02_001`, `h_A_02_002`, `h_A_04_001` all passed cleanly.
- `h_A_01_002` and `h_A_03_001` passed with deferrals/weakenings: cleanup first, bigger prompt moves later.

---

## 5. Implementation Plan

### S1. Delete dead execution paths and duplicate prompt copies

- **Goal:** remove code that no longer participates in the live Temporal runtime.
- **Do now:**
  - delete the unused Convex provider execution layer:
    - `convex/platform/providers/provider_services.ts`
    - `convex/platform/providers/openai_batch.ts`
    - `convex/platform/providers/ai_chat.ts`
    - likely `convex/platform/providers/openai_chat.ts` if it is also unused
  - delete the duplicate Convex window prompt file:
    - `convex/domain/window/evidence_prompts.ts`
  - audit and remove unused legacy settings/rate-limit helpers:
    - `convex/settings.ts`
    - `convex/utils/scheduling.ts`
- **Keep:**
  - the shared provider/model registry until a cleaner home is chosen
  - Convex-side prompt template/audit storage (`llm_prompt_templates`, `llm_attempts`)
- **Why:** this removes dead code and immediately clarifies that Temporal owns provider side effects. Evidence: `k_001`, `k_003`
- **Verification:**
  - no runtime imports remain for deleted files
  - tests/validation pass
  - README/operator docs no longer imply Convex-side provider execution

### S2. Normalize run-domain ownership and naming

- **Goal:** make `domain/runs` readable by role instead of historical accident.
- **Recommended changes:**
  - rename `experiments_data.ts` to either:
    - `experiments_service.ts`, or
    - `experiments_queries.ts` / `experiments_read.ts`
  - move run-specific read aggregation (`getRunSummary`) into a run-scoped read module
  - rename `bundle_plan_logic.ts` to:
    - `bundle_plan_materializer.ts`, or
    - `bundle_plan_strategies.ts`
  - split `experiments_repo.ts` into:
    - `experiments_repo.ts`
    - `pools_repo.ts`
  - split `bundle_plan_repo.ts` into:
    - persistence repo
    - service/derivation/matching layer
- **Why:** the current file names hide real responsibilities and make future cleanup harder. Evidence: `k_002`
- **Verification:**
  - every module maps clearly to one of: repo, service/read-model, or pure algorithm
  - public Lab functions route through clearly named owners

### S3. Split `engine-settings` into real settings and contracts modules

- **Goal:** make `engine-settings` a coherent package rather than a kitchen sink.
- **Recommended shape:**
  - `src/settings_schema.ts`
    - actual Zod schema for configurable engine settings/defaults
  - `src/contracts/process.ts`
    - process kinds, stage keys, control payload shapes
  - `src/contracts/quota.ts`
    - quota dimensions and reservation/settlement contracts
  - `src/env_keys.ts`
    - env-key constants only
  - `src/prompts/window.ts` or equivalent if prompts temporarily stay here
  - root `index.ts`
    - re-export the real settings surface only, or very small curated exports
- **Why:** the current root file mixes unrelated concerns and obscures the package’s purpose. Evidence: `k_003`
- **Verification:**
  - root package entry is recognizable as a settings surface
  - workflow/runtime imports pull only the submodules they need
  - prompts are no longer mixed into the same file as env keys and control contracts

### S4. Create single-source runtime validators and shared tuples

- **Goal:** stop reimplementing the same runtime shapes across packages.
- **Do now:**
  - centralize the canonical runtime validators for:
    - `ProcessSnapshot`
    - control actions / repair operations
    - run/window stage tuples
    - process execution statuses
  - infer TS types from the canonical validators where runtime validation is required
  - derive duplicated enum lists in analysis-export and Temporal client code from the same shared tuples
- **Why:** this directly addresses the “singular source of truth for Zod types” concern and reduces drift. Evidence: `k_003`
- **Verification:**
  - duplicated literal enums disappear from Convex worker API, Temporal client, and analysis export
  - changes to a stage/control enum require editing one source only

### S5. Fix run partial-failure progression semantics

- **Goal:** make run execution match the intended “continue with successes” behavior.
- **Required changes:**
  - change run-stage finalization so `failed > 0` does not automatically halt the run
  - add explicit downstream skip/fail propagation when prerequisites are missing
  - decide whether downstream dependents should be marked:
    - `skipped`, or
    - `failed` with an upstream-missing-prerequisite error
  - align terminal semantics with reporting:
    - `completed` + `has_failures=true` for partial-success runs
- **Why:** this is the main remaining correctness bug before the next pilot. Evidence: `k_004`
- **Verification:**
  - a run with one failed rubric and many successful rubrics still advances the successful sample set
  - downstream pending counts resolve correctly
  - summaries and diagnostics show partial-failure truth consistently

### S6. Make window/pool readiness explicit for partial transform failures

- **Goal:** avoid silently pooling or scoring on partially transformed evidence without visibility.
- **Recommended changes:**
  - add `has_failures` or equivalent window-level signal
  - clarify pool eligibility:
    - whether pools may include evidence that only reached `l0`/`l1`
    - or whether they must meet a minimum semantic-view threshold
  - surface fallback-to-lower-view behavior explicitly if it remains allowed
- **Why:** windows already tolerate partial failures, but the data-plane consequences are currently subtle. Evidence: `k_004`
- **Verification:**
  - operators can tell when a completed window finished with missing semantic stages
  - pool creation semantics are explicit and reproducible

### S7. Reduce stage-activity timeout risk and add pilot-scale tests

- **Goal:** avoid stage-level flakiness as run/window sizes grow.
- **Recommended changes:**
  - either increase `startToCloseTimeout` substantially, or
  - split stage activities into smaller units so one activity does not serialize an entire stage’s provider calls
  - add tests for:
    - run partial-failure propagation
    - partial-success completion semantics
    - larger stage-unit counts / timeout risk
- **Why:** five-minute whole-stage activities are a likely pilot-scale fragility. Evidence: `k_004`
- **Verification:**
  - pilot-scale runs do not time out under normal provider latency
  - tests explicitly cover failure propagation and partial completion

### S8. Reframe analysis export ownership without breaking the Python client

- **Goal:** clarify that the engine owns a data export surface for the analysis package, rather than pretending core engine logic lives in an “analysis domain.”
- **Recommended changes:**
  - rename/re-home `domain/analysis/export.ts` to an export- or reporting-oriented ownership name
  - keep the public API path stable initially, or provide shims
  - document the boundary clearly:
    - Convex owns export/query API
    - Python owns analysis logic, caching, figures, and reports
- **Why:** this is an ownership/documentation cleanup, not a runtime rewrite. Evidence: `k_001`
- **Verification:**
  - analysis package still works unchanged or with a clearly managed migration
  - engine ownership is easier to explain to contributors

---

## 6. Priority Order

If the objective is **clean up the codebase before the next pilot/decomp wave**, do this order:

1. `S5` run partial-failure progression
2. `S1` delete dead execution code and duplicate prompt copies
3. `S2` normalize run-domain ownership and naming
4. `S3` split `engine-settings`
5. `S4` centralize shared validators/tuples
6. `S6` window/pool readiness semantics
7. `S7` timeout-risk hardening and tests
8. `S8` analysis export reframing

Reason: `S5` is the only cleanup item here that is also a clear correctness bug for the next real pilot.

---

## 7. Open Questions

- For run partial failures, should downstream dependents be marked `skipped` or `failed`?
- Should a partially failed run end `completed` + `has_failures`, or `error` with a weaker continuation model only during pilot mode?
- Where should the canonical model/provider registry live long term:
  - `engine-convex`,
  - `engine-settings`,
  - or a dedicated shared contracts module?
- Do you want prompt helpers to remain in `engine-settings` under a dedicated submodule, or should they eventually move fully into `engine-temporal`?
- Should the next wave include explicit evidence-process decomposition, or should that wait until after this cleanup pass lands?

---

## 8. Exit Criteria For “Cleanup Ready”

The spring-cleaning pass is done when:

1. dead Convex execution code is removed and no README/operator docs imply otherwise,
2. `domain/runs` file names reflect actual ownership boundaries,
3. `engine-settings` has a real settings schema and smaller contract submodules,
4. duplicated runtime validators/enums are consolidated,
5. a run can partially succeed without dead-pending downstream work,
6. pilot-scale tests cover the new semantics,
7. contributors can explain package ownership in one sentence each:
   - `engine-convex` owns product state, queries, exports, and worker-facing mutations
   - `engine-temporal` owns execution and provider side effects
   - `engine-settings` owns shared settings/contracts only
   - `analysis` owns offline analysis, not engine runtime behavior
