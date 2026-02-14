# Blueprint: refactor-v2

> Refactor v2 moves orchestration into the engine (Convex) while preserving current engine guarantees, and introduces durable, versioned run configs plus a minimal CLI control surface for live monitoring. The plan below grounds decisions in existing engine invariants, Convex scheduling constraints, and external workflow/CLI patterns.
>
> This document is a prebuilt implementation plan. Each step is meant to be executable by an agent, with explicit evidence to consult before acting.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/judge-gym/_blueprints/refactor-v2
- **Research Question:** Investigate refactor v2: migrate orchestration into engine layer (Convex) while preserving existing engine guarantees; design durable, user-friendly configs and CLI controls (start/pause/cancel/inspect, evidence collection workflows), with schema-first approach; consider scheduler constraints; no analysis-layer changes.
- **Scope:** Engine-layer orchestration, schema refactor for durable configs, minimal CLI control surface for monitoring, evidence collection workflow entrypoints, scheduler constraints.
- **Non-goals:** Analysis layer changes, scoring model changes, new evaluation metrics, UI work.
- **Constraints:** Preserve current engine guarantees; schema-first; use Convex scheduler semantics safely; configs must be durable source of truth; tables assumed wiped before refactor.

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

- **k_001 (Engine Guarantees):** Idempotent experiment init, request de-duplication via identity index, run stage tracking, leased batch polling, policy-driven retries, and stage gating for critics/scoring. (`knowledge/k_001_engine_guarantees.md`)
- **k_002 (Convex Scheduler):** Atomic scheduling from mutations vs non-atomic from actions; exactly-once vs at-most-once semantics; cron overlap skips; execution/argument limits. (`knowledge/k_002_convex_scheduler.md`)
- **k_003 (Config Durability):** External workflow engines emphasize immutable, versioned configs with schema validation, deterministic workflows, and explicit concurrency constraints. (`knowledge/k_003_config_durability.md`)
- **k_004 (CLI Patterns):** Start/cancel/pause/resume + status/watch/wait and log streaming are common CLI control patterns. (`knowledge/k_004_cli_control.md`)

**Critical gaps:** Falsifier subagent failed to return; null challenges were authored by lead. Confidence on null-challenge outcomes should be treated as provisional.

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_engine_guarantees | Engine guarantees + orchestration/data model | 019c599d-7615-7871-a60b-fec685eaebd4 | k_001 |
| A_convex_scheduler | Convex scheduler/orchestration constraints | 019c599d-7624-7c32-afc6-a980588ff9ec | k_002 |
| A_config_durability | Durable config/versioning patterns | 019c599d-7640-72b1-85dc-e1aec7308e9e | k_003 |
| A_cli_control | CLI control + live status patterns | 019c599d-766b-7242-a1fc-3ab1050f3d86 | k_004 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_engine_001 | Strict idempotency for request creation needs deterministic IDs or a mutex beyond composite index. | k_001 | 0.50 |
| h_A_engine_002 | Run stage refresh must target the intended active run to avoid completion drift. | k_001 | 0.46 |
| h_A_convex_001 | Schedule orchestration steps from mutations to preserve atomicity. | k_002 | 0.59 |
| h_A_config_001 | Store immutable, schema-validated run-config snapshots with code metadata as durable truth. | k_003 | 0.63 |
| h_A_config_002 | Centralize rate-limit/concurrency constraints in engine policy objects. | k_003 | 0.57 |
| h_A_cli_001 | CLI should provide status and watch/poll for live monitoring; other controls can be minimal initially. | k_004 | 0.60 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_engine_001 | Inconclusive | k_001 (no explicit uniqueness constraints found) |
| h_A_engine_002 | Inconclusive | k_001 (no explicit single-run constraint found) |
| h_A_convex_001 | Passed | k_002 (actions may still be needed for side effects) |
| h_A_config_001 | Inconclusive | k_003 (sources do not address secret handling) |
| h_A_config_002 | Passed | k_003 (pools/tags help but are not adaptive) |
| h_A_cli_001 | Inconclusive | k_004 (rich controls are common but not required) |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviews evidence and hypotheses.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** h_A_engine_002 (run overlap), h_A_engine_001 (idempotency), k_004 (CLI patterns applicability).

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

### S1: Define Durable Config Model + Versioning

- **Objective:** Design an immutable run-config snapshot schema and versioned config templates that preserve engine guarantees and enable team-specific constraints.
- **Evidence to Review:** k_001, k_003
- **Inputs:** Existing schema in `packages/engine/convex/schema.ts`, current experiment config shape.
- **Actions:**
  1. Draft schema changes for `config_templates` (versioned) and `run_configs` snapshot tables (immutable) with code metadata and validation status.
  2. Explicitly define that run configs are immutable; no mid-run overrides.
  3. Define mapping from `experiment_tag` to template version + run_config snapshot at start.
  4. Specify a config-ingestion path (internal mutation or CLI seed step) that writes `config_templates` and normalizes `evidence_view` before computing `spec_signature`.
- **Outputs:** Schema diff proposal; config-versioning spec doc.
- **Verification:** Schema review shows all required fields represented; run config can reproduce a run without local config files.
- **Risks/Assumptions:** None; secrets are not stored in configs.
- **Confidence:** 0.63

### S2: Engine-Orchestrated State Machine (Runs + Evidence Workflows)

- **Objective:** Move orchestration into engine while preserving idempotency, staged progression, and retry guarantees.
- **Evidence to Review:** k_001, k_002
- **Inputs:** `packages/engine/convex/domain/*` workflows and scheduler semantics.
- **Actions:**
  1. Specify engine-side state machine: `queued → running → paused/canceled → complete` (pause optional in CLI, still supported in engine for future).
  2. Determine which scheduling steps must be mutations for atomicity and which can be actions.
  3. Define lease/lock strategy for polling and concurrency (reuse `locked_until`).
  4. Explicitly disallow multiple active runs per `experiment_tag` in the new design (single-run invariant).
  5. Enforce single-run invariant via a concurrency-safe lock (e.g., patching the experiment doc with `active_run_id` in the same mutation so concurrent starts conflict).
- **Outputs:** Orchestration state machine spec and scheduling plan.
- **Verification:** All stages are represented; atomic scheduling is used for critical state transitions; single-run invariant documented and enforced.
- **Risks/Assumptions:** Some steps may require action-level side effects.
- **Confidence:** 0.59

### S3: Policy Objects for Rate Limits + Concurrency

- **Objective:** Centralize team/provider/model constraints in engine policy objects and apply to batch queueing and scheduling.
- **Evidence to Review:** k_003, k_001
- **Inputs:** Current policy config in `packages/engine/convex/models/core.ts` and queue logic.
- **Actions:**
  1. Define a `policies` schema capturing rate limits and concurrency scopes (global/team/provider/model).
  2. Integrate policy checks into batch queue selection and scheduler cadence.
  3. Specify override rules (global → team → provider → model → experiment) and enforce precedence.
- **Outputs:** Policy schema + enforcement spec.
- **Verification:** Queue logic enforces limits without external configuration files.
- **Risks/Assumptions:** Dynamic provider limits may require adaptive signals later.
- **Confidence:** 0.57

### S4: Env Preflight Validator + .env.example

- **Objective:** Replace T3 env usage with a simple preflight validator that checks required envs per workflow, and provide `.env.example` documentation.
- **Evidence to Review:** k_001
- **Inputs:** Current env usage in engine and lab/CLI.
- **Actions:**
  1. Identify workflows and required envs (e.g., evidence scrape requires `FIRECRAWL_API_KEY`; OpenAI model requires `OPENAI_API_KEY`).
  2. Implement a shared `preflightCheck(requiredEnvs: string[])` helper in engine and a CLI call path to run it before starting workflows.
  3. Add `.env.example` listing required envs and brief descriptions (no secrets in configs).
  4. Remove or ignore T3 env tooling; centralize env handling in Convex.
  5. Run preflight **before** inserting a run or scheduling actions; if preflight fails, do not create a run.
- **Outputs:** Preflight validator spec; `.env.example` spec.
- **Verification:** Attempted run fails fast with clear missing-env error; successful run proceeds.
- **Risks/Assumptions:** None; envs are managed via Convex.
- **Confidence:** 0.64

### S5: Minimal CLI Control Surface + State APIs

- **Objective:** Define minimal CLI commands and corresponding engine endpoints for live monitoring.
- **Evidence to Review:** k_004, k_001
- **Inputs:** Existing CLI/lab entrypoints, desired polling model.
- **Actions:**
  1. Specify CLI commands: `experiments status <tag|run_id>`, `experiments watch <tag|run_id> [--json]`.
  2. Optionally define `experiments start` and `experiments cancel` if needed for automation.
  3. Map commands to engine queries/mutations and response shapes.
- **Outputs:** CLI spec + API contract doc.
- **Verification:** `status` and `watch` return consistent, human-readable or JSON outputs.
- **Risks/Assumptions:** Polling cadence needs tuning for usability.
- **Confidence:** 0.60

### S6: Evidence Collection Workflow Entry Points

- **Objective:** Provide engine-first APIs to start evidence collection and monitor its progress.
- **Evidence to Review:** k_001, k_002
- **Inputs:** Existing evidence schemas, experiments/runs tables.
- **Actions:**
  1. Define evidence workflow stages (ingest → clean → neutralize → ready) and required state transitions.
  2. Tie evidence workflows to run stages and CLI monitoring outputs.
  3. Ensure idempotent entrypoints for evidence workflows.
- **Outputs:** Evidence workflow spec + stage mapping.
- **Verification:** Evidence stages can be restarted without duplicates; progress is visible via CLI `status`/`watch`.
- **Risks/Assumptions:** Current evidence pipeline supports re-entrancy.
- **Confidence:** 0.55

### S7: Migration + Backward Compatibility Plan

- **Objective:** Map existing experiment data and workflows onto the new schema and orchestration model.
- **Evidence to Review:** k_001, k_003
- **Inputs:** Current schema and reset behaviors; table wipe assumption.
- **Actions:**
  1. Document migration steps from old config usage to new `run_configs` snapshots.
  2. Define how existing `experiment_tag` behavior and `spec_signature` checks map to new schemas.
  3. Identify any legacy fields to deprecate or collapse.
- **Outputs:** Migration plan doc (no code changes yet).
- **Verification:** Plan supports clean boot with wiped tables and deterministic reruns.
- **Risks/Assumptions:** Hidden dependencies in lab/CLI scripts.
- **Confidence:** 0.54

### S8: Validation + Test Strategy

- **Objective:** Define the minimal test suite to preserve engine guarantees post-refactor.
- **Evidence to Review:** k_001, k_002
- **Inputs:** Existing idempotency and run-state behaviors.
- **Actions:**
  1. Specify tests for idempotent experiment init, request creation, and scheduling atomicity.
  2. Add concurrency tests for batch polling locks and rate-limit enforcement.
  3. Define acceptance criteria for CLI `status` and `watch` outputs.
- **Outputs:** Test matrix and acceptance criteria.
- **Verification:** Each step has measurable pass/fail criteria.
- **Risks/Assumptions:** Need to simulate concurrency in tests.
- **Confidence:** 0.56

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged (note: falsifier output missing; revisit before implementation).
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions

- Which orchestration steps truly require actions (external side effects) vs mutations?
- Which CLI outputs (human vs JSON) should be default?
- Are there any envs we expect to be optional vs required per workflow?

---

## 9A. Final Decisions Checklist (Implementation Baseline)

These decisions are **approved** and should be treated as requirements for implementation.

1. **Single-Run Invariant (per `experiment_tag`):**
   - At most one active run per experiment (`pending|running|paused`).
   - On conflict, return a structured error (e.g., `active_run_exists`), do not auto-cancel.
   - Multiple experiments may run concurrently (no global single-run lock).

2. **Batch Start for Multiple Experiments:**
   - Provide a mutation `start_experiments({ tags: string[] })` that calls `start_experiment` per tag.
   - Return `{ started: { tag, run_id }[], failed: { tag, error }[] }`.
   - (Optional, defer) `run_groups` table if needed for group-level monitoring.

3. **Scheduler Boundaries:**
   - **Mutations** handle atomic scheduling transitions (run creation, stage enqueueing, lease/lock updates).
   - **Actions** perform external side effects (LLM provider calls, Firecrawl search, network I/O).
   - Polling uses `locked_until` leases + `next_poll_at`.

4. **Evidence View Rename Compatibility:**
   - New enums: `l0_raw | l1_cleaned | l2_neutralized | l3_abstracted`.
   - Accept old values on input and normalize to new enums before storage.
   - Store only new enum values in DB.

5. **Durable Config Tables:**
   - `config_templates` (versioned, append-only):
     - `template_id`, `version`, `schema_version`, `config_body`, `created_at`, `created_by`, `notes`, `spec_signature`.
   - `run_configs` (immutable snapshots):
     - `run_config_id`, `template_id`, `version`, `config_body`, `created_at`,
       `git_sha`, `spec_signature`, `validation_status`.
   - Policy/rate-limit settings are stored **inside the run_config snapshot**.

6. **Policy Precedence:**
   - Override order: global → team → provider → model → experiment.
   - Missing scopes fall back to higher scope; do not hard-error.

7. **Minimal CLI Surface:**
   - Required:
     - `experiments status <tag|run_id>`
     - `experiments watch <tag|run_id> [--json]`
     - `experiments start --tags a,b,c` (or `start <tag>` + batch wrapper)
   - Optional (defer): `experiments cancel <tag|run_id>`.

8. **Env Preflight (Convex-managed):**
   - Implement `preflightCheck(required: string[])`.
   - Required envs by workflow:
     - Evidence scrape: `FIRECRAWL_API_KEY`
     - OpenAI models: `OPENAI_API_KEY`
     - Anthropic/Google only if used by config.
   - `.env.example` lives at repo root.

9. **Evidence Pipeline Semantics:**
   - No new evidence stage field; readiness is inferred by content fields.
   - Retries use existing LLM request retry behavior.

10. **Reset Behavior:**
    - `nukeTables` is internal-only, no CLI exposure, wipes all tables.

---

## 9B. Implementation Order (Recommended)

1. **Schema + Models**
   - Add `config_templates` + `run_configs` tables.
   - Update `evidence_view` enum to `l0_*` and add normalizer.
   - Add a concurrency-safe run lock field (e.g., `experiments.active_run_id`) or lock table for single-run invariant.
2. **Repo + Core Helpers**
   - Add CRUD for config tables.
   - Add config ingestion / seeding path (internal mutation or CLI seed step) that normalizes `evidence_view` before hashing.
   - Add `preflightCheck`.
   - Add policy resolution helper (global → team → provider → model → experiment).
3. **Orchestration (Engine)**
   - Implement run creation with single-run invariant.
   - Implement `start_experiments` batch entrypoint.
   - Wire scheduler boundaries (mutations vs actions).
4. **Workflows Integration**
   - Update evidence workflows to use new evidence_view values.
   - Update experiment stage workflows to read run_config snapshots.
5. **CLI (Minimal)**
   - Implement `status`, `watch`, `start --tags`.
6. **Tests**
   - Update existing tests to new enum names.
   - Add tests for single-run invariant + config immutability.
7. **Validation**
   - Run `bun run typecheck` and required test suite.

---

## 9C. Test Updates Checklist

These are expected to fail after the refactor unless updated. Treat as required changes.

1. **Evidence view rename**
   - `packages/engine/tests/strategies_resolve.test.ts`
     - Update evidence_view assertions to `l0_raw/l1_cleaned/l2_neutralized/l3_abstracted`.
   - `packages/engine/tests/prompts_scoring.test.ts`
     - Update `evidence_view` in configs to `l0_raw`.

2. **Spec signature inputs**
   - Any test or fixture that hashes config objects must normalize evidence_view to new values.

3. **Schema-dependent tests**
   - Add coverage for `config_templates` + `run_configs` schemas if new tables affect existing fixtures.

---

## 9D. Handoff Requirements (Do Not Skip)

These requirements reduce ambiguity for a fresh agent executing the blueprint.

1. **Evidence view normalizer**
   - Accept old values (`raw|cleaned|neutralized|abstracted`) at input, normalize to `l0_*` before storage and hashing.
   - Store only `l0_*` in DB.

2. **Run invariant enforcement**
   - Enforce single active run per experiment_tag via mutation guard (structured error `active_run_exists`).
   - Must be concurrency-safe (lock the experiment doc or equivalent) to avoid double-starts.

3. **Config immutability**
   - `run_configs` are immutable; mutations must not patch them after creation.

4. **CLI location**
   - CLI remains minimal and only provides status/watch/start; no admin/nuke.


## 10. Proposed Change: Evidence View Naming Refactor (L0/L1/L2/L3)

- **Objective:** Standardize evidence normalization levels as `l0_raw`, `l1_cleaned`, `l2_neutralized`, `l3_abstracted` across schema + config + workflows, while preserving the current semantics.
- **Motivation:** Align experimental specs with evidence workflow naming, remove ambiguity, and make normalization level explicit as a first-class config option.
- **Scope:** Convex schema + models + config enums + evidence workflows + tests (mapping only; no behavior change).
- **Non-goals:** Changes to evidence generation logic, new normalization stages, or analysis-layer updates.
- **Proposed Mapping (New Enum → Existing Semantics):**
  - `l0_raw` → uses `raw_content`
  - `l1_cleaned` → uses `cleaned_content`
  - `l2_neutralized` → uses `neutralized_content`
  - `l3_abstracted` → uses `abstracted_content`
- **Changes (Planned):**
  1. Replace `evidence_view` enum values in `packages/engine/convex/models/core.ts` with `l0_raw | l1_cleaned | l2_neutralized | l3_abstracted`.
  2. Update evidence workflow arg enums + logic in `packages/engine/convex/domain/evidence/workflows/collect.ts`.
  3. Update evidence strategy resolver in `packages/engine/convex/domain/experiments/strategies/evidence.strategy.ts`.
  4. Update config hash/signature logic in `packages/engine/convex/utils/spec_signature.ts` to use new values.
  5. Update tests in `packages/engine/tests/*.test.ts` that assert `evidence_view` strings or resolution.
  6. Optional (only if we need backwards compatibility): add a normalizer that accepts old values (`raw|cleaned|neutralized|abstracted`) and maps to new enums.
- **Compatibility Note:** This is a breaking schema change. If any persisted configs exist, a migration or compatibility shim will be required.
- **Verification:** Typecheck passes, and evidence strategy still maps to the same content fields as before.

---

## Appendix: Sources

- `knowledge/k_001_engine_guarantees.md`
- `knowledge/k_002_convex_scheduler.md`
- `knowledge/k_003_config_durability.md`
- `knowledge/k_004_cli_control.md`
- `certainty/certainty_report.md`
- `null_challenges/nc_h_A_engine_001_challenge.json`
- `null_challenges/nc_h_A_engine_002_challenge.json`
- `null_challenges/nc_h_A_convex_001_challenge.json`
- `null_challenges/nc_h_A_config_001_challenge.json`
- `null_challenges/nc_h_A_config_002_challenge.json`
- `null_challenges/nc_h_A_cli_001_challenge.json`
