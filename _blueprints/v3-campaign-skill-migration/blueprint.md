# Blueprint: V3 campaign skill migration

> This research pass focused on what still needs to be analyzed before moving V3 finish-pass operations out of repo docs and into a bespoke autonomous skill. The conclusion is that a broad codebase analysis is no longer necessary; the remaining blockers are concentrated in the control plane, documentation split, campaign-state semantics, and pre-wipe forensic capture. Existing codex/lab/danger primitives are already strong enough for a first version, but the repo lacks a mission-specific control plane and durable campaign memory.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-campaign-skill-migration
- **Research Question:** What still needs to be analyzed across the judge-gym codebase and docs before migrating V3 finish-pass operations into a bespoke autonomous campaign skill, and what exact documentation/control-plane/state design should that migration use?
- **Scope:** V3 finish-pass control plane, documentation split, campaign-state design, forensic snapshot requirements, fresh-agent bootstrap path
- **Non-goals:** Engine bug fixing, parser/provider diagnosis, new runtime orchestration features unrelated to the campaign migration
- **Constraints:** Do not implement code in this research pass; rely on current repo/code/docs truth

---

## 1. Evidence Ledger (Grounding)

- `k_001` — Existing primitives already cover reset / launch / status / heal / bundle inspection, but only at low-level process granularity. (`knowledge/k_001_control_plane_primitives.md`)
- `k_002` — Repo docs are role-confused and overlapping; `AGENTS.md`, `README.md`, `docs/live_debug_loop.md`, and `docs/pilots/v3_specs.md` currently share too much operational responsibility. (`knowledge/k_002_docs_source_of_truth_drift.md`)
- `k_003` — Engine states are useful substrate, but the autonomous loop needs its own campaign-state layer above them. (`knowledge/k_003_campaign_state_machine.md`)
- `k_004` — Observability is already sufficient to assemble a pre-wipe forensic bundle, but no first-class iteration snapshot artifact exists. (`knowledge/k_004_forensic_snapshot_requirements.md`)
- `k_005` — Fresh-agent bootstrap is viable today, but campaign memory and manifest-based launch intent are missing. (`knowledge/k_005_fresh_agent_bootstrap_and_manifest.md`)

Critical drift surfaced during the pass:
- current committed code uses the simplified `scoring_config.evidence_bundle_size`, not the previously discussed `evidence_grouping`
- `packages/codex:reseedV3Experiments` is stale relative to the current V3 spec and bundle semantics

---

## 2. What still needed analysis — final answer

The targeted pass indicates that **we do not need a broad additional codebase investigation** before the migration. The remaining analysis surface is now narrow and decision-relevant:

1. **Control-plane sufficiency**
   - determine whether existing codex/lab/danger primitives are enough for v1 of the skill
   - conclusion: yes for v1, but cohort-level launch/reset/status is still manual stitching (`k_001`)

2. **Documentation role split**
   - determine what remains in `AGENTS.md` versus docs versus the skill
   - conclusion: `AGENTS.md` should become repo-only; the mission loop should move out (`k_002`)

3. **Campaign-state semantics**
   - define campaign states above engine states (`running`, `paused`, etc.)
   - conclusion: a dedicated campaign-state layer is required (`k_003`)

4. **Pre-wipe forensic minimums**
   - define the exact artifact that must be written before any run-scoped wipe
   - conclusion: current surfaces are enough, but composition is missing (`k_004`)

5. **Fresh-agent control contract**
   - decide what belongs in a manifest versus what should stay runtime-derived
   - conclusion: use a dedicated manifest and campaign directory (`k_005`)

The most important correction from this schema check is that the migration does **not** need to design around a rich bundle-config object right now. The live repo truth is a simpler scoring config with `evidence_bundle_size` as the bundle ablation knob. That reduces migration complexity: the first manifest/skill version should mirror current config shape exactly rather than inventing a more elaborate bundle schema.

What does **not** need more pre-migration analysis:
- parser/provider/runtime failure research
- more table spelunking
- more engine monitoring doctrine
- more experimentation on the current full-load loop

Those are implementation/runtime concerns, not blockers to designing the migration.

---

## 3. Areas of Analysis Summary

| Area ID | Scope | Main conclusion | Evidence |
| :------ | :---- | :-------------- | :------- |
| A_01 | Control-plane primitives and gaps | Existing primitives are strong enough, but no mission-level control plane exists | `k_001` |
| A_02 | Docs/source-of-truth drift | Documentation roles are confused and must be split before a fresh agent can trust them | `k_002` |
| A_03 | Autonomous loop state machine | Engine state is substrate; campaign state must be explicit | `k_003` |
| A_04 | Forensic snapshot/observability minimums | Need a first-class iteration snapshot artifact before wipes | `k_004` |
| A_05 | Fresh-agent bootstrap + manifest | Need dedicated campaign memory and machine-readable manifest | `k_005` |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| `h_A_01_001` | Existing low-level primitives are enough for v1; the main missing piece is a mission-specific control plane | `k_001`, `k_005` | 0.84 |
| `h_A_02_001` | The migration should slim `AGENTS.md` and move V3 truth into a manifest + skill | `k_002`, `k_005` | 0.89 |
| `h_A_04_001` | The highest-value missing artifact is a first-class pre-wipe iteration snapshot | `k_004`, `k_003` | 0.85 |

Null challenge outcome: **Mixed**. The falsifier did not overturn the direction, but softened absolute claims: existing docs/helpers are not useless, and a cohort helper may still be worthwhile later. See `null_challenges/nc_v3_campaign_skill_migration_core.json`.

---

## 5. Prebuilt implementation direction

### S1 — Freeze the doc-role split before touching runtime behavior
- **Objective:** prevent further documentation drift while the skill is introduced
- **Evidence to review:** `k_002`, `k_005`
- **Actions:**
  1. Slim `AGENTS.md` to stable repo rules, validation, commit practice, and minimal fresh-context bootstrap.
  2. Reduce `docs/live_debug_loop.md` to generic codex/debug-surface reference only.
  3. Rewrite `docs/pilots/v3_specs.md` as human-facing experiment spec only; remove operational checklists and align bundle terminology to current code.
- **Outputs:** slimmer `AGENTS.md`, cleaner `docs/live_debug_loop.md`, cleaned `v3_specs.md`
- **Verification:** a fresh agent can identify which file is for repo rules, which is for generic debug reference, and which is for V3 experiment rationale without ambiguity.
- **Confidence:** 0.90

### S2 — Add `_campaigns/v3_finish_pass/` as the campaign memory layer
- **Objective:** give the autonomous loop durable state and memory across repeated wipe/relaunch cycles
- **Evidence to review:** `k_003`, `k_004`, `k_005`
- **Actions:**
  1. Create `_campaigns/v3_finish_pass/manifest.json` for launch-critical V3 contract.
  2. Create `campaign_state.json`, `bug_ledger.json`, and `observability_backlog.json`.
  3. Define `iterations/<id>/snapshot.json` and `iterations/<id>/report.md` as required outputs before any wipe.
- **Outputs:** campaign directory structure and schema contracts
- **Verification:** a fresh agent can load campaign intent and prior loop state without reading chat history.
- **Confidence:** 0.88

### S3 — Build a V3-specific skill that owns the loop
- **Objective:** move mission logic out of repo-global docs and into a narrow, stateful automation protocol
- **Evidence to review:** `k_001`, `k_003`, `k_004`, `k_005`
- **Actions:**
  1. Define the loop: load state → snapshot current environment → reset run-scoped state → launch cohort → monitor → bounded safe-heal → freeze forensics if unhealthy → patch → validate → commit → repeat.
  2. Encode campaign-level state vocabulary and failure taxonomy.
  3. Define subagent roles only for investigation/synthesis, not implementation.
- **Outputs:** V3-specific skill spec and artifact requirements
- **Verification:** the skill can run the loop using current codex/lab/danger primitives plus manifest/state files.
- **Confidence:** 0.86

### S4 — Decide whether a thin cohort helper is needed after the first skill version
- **Objective:** avoid premature backend changes if the skill can successfully coordinate existing primitives
- **Evidence to review:** `k_001`, falsifier output, certainty report
- **Actions:**
  1. Start with existing codex/lab primitives as the execution substrate.
  2. Only add a helper if the first skill iteration still spends too much logic on cohort launch/reset/status stitching.
  3. If added later, make it a thin helper that reads the manifest rather than embedding cohort truth in backend code.
- **Outputs:** explicit defer/accept decision on helper/API work
- **Verification:** first skill dry-run shows whether manual stitching remains error-prone.
- **Confidence:** 0.67

---

## 6. Validation gates for the migration

1. **Role-clarity gate** — a fresh agent can identify the correct source of truth for repo rules, generic debug operations, V3 experiment rationale, and V3 campaign automation.
2. **Manifest sufficiency gate** — `manifest.json` contains enough launch/reset truth that the skill does not have to infer cohort intent from prose.
3. **Forensics gate** — the skill refuses to wipe run-scoped state before writing a full iteration snapshot.
4. **Fresh-context gate** — a new agent can pick up mid-campaign using only `_campaigns/v3_finish_pass/` + MCP/docs, not chat history.
5. **Drift gate** — bundle terminology and config shape are aligned between code, human docs, and manifest.

---

## 7. Open questions

- Should the first skill version directly call current primitives one-by-one, or should a thin cohort helper be added immediately?
- Should `reseedV3Experiments` be retired, or reworked as a helper that reads the new manifest?
- Should the campaign snapshot stay as composed JSON/markdown files, or should a codex API eventually emit a cohort-level snapshot directly?

---

## Appendix: Sources

- `knowledge/k_001_control_plane_primitives.md`
- `knowledge/k_002_docs_source_of_truth_drift.md`
- `knowledge/k_003_campaign_state_machine.md`
- `knowledge/k_004_forensic_snapshot_requirements.md`
- `knowledge/k_005_fresh_agent_bootstrap_and_manifest.md`
- `null_challenges/nc_v3_campaign_skill_migration_core.json`
- `certainty/certainty_report.md`
