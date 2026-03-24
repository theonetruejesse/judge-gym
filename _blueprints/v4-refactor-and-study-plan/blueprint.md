# Blueprint: V4 Refactor And Study Plan

> V4 should be planned in two layers. The **target architecture** is a broader evaluator-regime engine that can import non-news evidence, support multiple provider capability surfaces, and express more than one adjudication family. The **wave-1 plan** should be narrower: one flagship paper-audit spine, a minimal evidence substrate, a compatibility bridge on top of the existing runner, and at most one direct-only non-OpenAI robustness slice.
>
> This document is a prebuilt execution plan. Each step is intended to be actionable without re-deriving the main decisions.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/jg/judge-gym/_blueprints/v4-refactor-and-study-plan
- **Research Question:** Plan the judge-gym V4 refactor and self-contained study design, focusing on evidence/window schema redesign, support for Anthropic and OpenRouter as the first two non-OpenAI provider surfaces, experiment and prompt-surface generalization for paper-audit targets plus contested-concept studies, and the concrete next-step deliverables needed to execute this work.
- **Scope:** evidence substrate redesign, discovery/content-acquisition redesign, provider/runtime abstraction direction, prompt/config generalization, and self-contained wave-1 paper design.
- **Non-goals:** code implementation, live workflow execution, provider deployment, and final paper target bundle inspection.
- **Constraints:** research only; no mutating engine changes; planning must stay grounded in current repo constraints and avoid turning wave 1 into a platform rewrite by accident.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` tracks agent assignments, evidence, hypotheses, null challenges, and certainty scores.

- **Lead:** Codex
- **Researchers:** Peirce (`A_evidence_schema`), James (`A_provider_runtime`), Raman (`A_experiment_prompt_surface`), Sartre (`A_self_contained_study_design`)
- **Falsifier:** Pauli
- **Certainty scorer:** Hypatia
- **Certainty report:** `certainty/certainty_report.md`

---

## 2. Evidence Ledger (Grounding)

- `k_001_repo_baseline_evidence.md`
  Current repo state is still OpenAI-centric, article-window-centric, and rubric-first.
- `k_002_evidence_schema_evidence.md`
  V4 needs a canonical import-ready evidence substrate, but the wave-1 version should be smaller than the long-run schema proposal.
- `k_003_provider_runtime_evidence.md`
  A provider-capability layer plus transport adapters is the correct architectural seam; wave-1 multi-provider claims should be narrower than the long-run architecture.
- `k_004_experiment_surface_evidence.md`
  The current experiment surface is pilot-specific; V4 should separate evidence, adjudication task, rubric source, scoring regime, execution, and reporting.
- `k_005_study_scope_evidence.md`
  The strongest self-contained paper shape is a flagship paper-audit spine, not a full multi-target, multi-provider, multi-task launch matrix.
- `k_006_mediacloud_source_evidence.md`
  Media Cloud should be treated as the new discovery/index layer, while raw-content hydration remains a separate capability.

Critical gaps:

- exact wave-1 audit target and target bundle still need final locking
- comparator support should stay deferred unless wave-1 evidence contracts widen
- non-OpenAI support should stay direct-only unless throughput requirements force more
- discovery and hydration should be split before Firecrawl is fully displaced

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_evidence_schema | Replace article-window identity with a V4 evidence substrate without breaking legacy news workflows | Peirce | k_001, k_002 |
| A_provider_runtime | Generalize provider support for Anthropic and OpenRouter without hard-coding OpenAI transport semantics | James | k_001, k_003 |
| A_experiment_prompt_surface | Generalize experiment and prompt surfaces beyond the current pilot pipeline | Raman | k_001, k_004 |
| A_self_contained_study_design | Turn V4 into a standalone paper plan rather than a pilot continuation | Sartre | k_001, k_005 |
| A_source_replacement | Replace Firecrawl search with a Media Cloud-centered discovery architecture without breaking content acquisition | Wegener | k_001, k_006 |

---

## 4. Micro-Hypotheses

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_v4_001 | Wave 1 should be centered on one flagship paper-audit spine rather than a broad multi-target matrix. | k_005 | 0.78 |
| h_v4_002 | Wave 1 should land a minimal import-ready evidence substrate, not the full long-run schema. | k_002 | 0.80 |
| h_v4_003 | The correct provider architecture is capabilities plus adapters, with only one non-OpenAI direct-only slice needed in wave 1. | k_003 | 0.85 |
| h_v4_004 | A generic StagePlan runner should be deferred out of wave 1. | k_004 | 0.74 |
| h_v4_005 | Media Cloud should replace Firecrawl as the discovery layer, while hydration remains a separate fetch capability. | k_006 | 0.84 |

---

## 5. Null Challenge Summary

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_v4_001 | Passed with narrowing | Broad launch-bundle ambition created scope sprawl in the falsifier pass |
| h_v4_002 | Passed | Full schema plus migration tax looked too expensive for wave 1 |
| h_v4_003 | Passed with weakening | Broad multi-provider claims and batching looked too ambitious for first-wave execution |
| h_v4_004 | Passed | Fixed-stage runner constraints make a generic StagePlan look like a platform rewrite |
| h_v4_005 | Passed | A literal drop-in swap is not supported by the current content contract; a discovery/hydration split is the defensible path |

See `null_challenges/nc_v4_scope_challenge.json`.

---

## 6. Certainty Scoring Summary

- **Highest-confidence direction:** provider capabilities plus adapters (`0.85`)
- **Strong but still scope-sensitive direction:** minimal evidence substrate (`0.80`)
- **New high-signal direction:** split discovery from hydration and treat Media Cloud as the discovery layer (`0.84`)
- **Lowest-confidence wave-1 direction:** full generic StagePlan (`0.40` in the underlying certainty pass)
- **Lowest-confidence claim class:** broad multi-provider headline claims in wave 1 (`0.35`)

See `certainty/certainty_report.md`.

---

## 7. Prebuilt Implementation Plan

### S1: Lock The Wave-1 Paper Spine

- **Objective:** Freeze the scientific scope before refactors start driving the study instead of the other way around.
- **Evidence to Review:** `k_005`, `k_003`, `k_004`
- **Inputs:** `deliverables/04_v4_self_contained_study_plan.md`, `deliverables/06_v4_paper_outline.md`
- **Actions:**
  1. Fix wave 1 as a flagship paper-audit study.
  2. Treat comparator work as deferred unless evidence contracts widen.
  3. Limit wave-1 perturbations to two matched contrasts.
- **Outputs:** locked study spine memo
- **Verification:** the wave-1 paper can be described in one paragraph without mentioning platform-generalization goals
- **Risks/Assumptions:** depends on the flagship target remaining reconstructable
- **Confidence:** `0.90`

### S2: Design The Minimal Evidence Substrate

- **Objective:** Support imported audit datasets without forcing every future ingestion abstraction into wave 1.
- **Evidence to Review:** `k_001`, `k_002`, `k_006`
- **Inputs:** `deliverables/01_evidence_window_schema_plan.md`, `deliverables/07_mediacloud_source_replacement_plan.md`
- **Actions:**
  1. Define the minimum import-ready evidence objects and invariants.
  2. Preserve `windows` and related legacy workflows as a convenience layer.
  3. Add a first-class distinction between discovered candidates and hydrated content.
  4. Explicitly defer generalized ingestion primitives that are not yet required.
- **Outputs:** evidence-core requirements doc
- **Verification:** imported audit items can be represented without per-paper one-off hacks
- **Risks/Assumptions:** if wave 1 reintroduces comparator-style payloads, the minimal substrate may be too narrow
- **Confidence:** `0.70`

### S2A: Design The Discovery/Hydration Split

- **Objective:** Replace Firecrawl-as-search with a Media Cloud-centered discovery layer without pretending Media Cloud is a raw-content scraper.
- **Evidence to Review:** `k_001`, `k_006`
- **Inputs:** `deliverables/07_mediacloud_source_replacement_plan.md`
- **Actions:**
  1. Define the `DiscoveryProvider` contract.
  2. Define the `ContentFetcher` contract.
  3. Define the candidate metadata that must survive from Media Cloud into the evidence store.
  4. Keep the legacy Firecrawl path intact until the hybrid path is stable.
- **Outputs:** acquisition-provider requirements doc
- **Verification:** a single wave-1 window/audit collection can be described as `discover -> hydrate -> transform`
- **Risks/Assumptions:** if a supported full-text acquisition path emerges, this split may be simplified later
- **Confidence:** `0.84`

### S3: Introduce The Prompt/Config Bridge

- **Objective:** Make paper-audit runs expressible in config without building a full generic stage runner.
- **Evidence to Review:** `k_004`, `k_005`
- **Inputs:** `deliverables/03_experiment_prompt_surface_plan.md`
- **Actions:**
  1. Add adjudication-task typing and rubric-source typing.
  2. Add strict output-contract and compatibility-mode concepts.
  3. Keep the current fixed runner as the execution backbone for wave 1.
- **Outputs:** experiment-surface requirements doc
- **Verification:** the chosen flagship audit can be expressed without bespoke orchestration logic
- **Risks/Assumptions:** depends on the audit target not requiring pairwise or replay-heavy logic in wave 1
- **Confidence:** `0.60`

### S4: Land The Provider Scaffold Conservatively

- **Objective:** Decouple OpenAI assumptions without overscoping multi-provider claims.
- **Evidence to Review:** `k_001`, `k_003`
- **Inputs:** `deliverables/02_provider_runtime_support_plan.md`
- **Actions:**
  1. Introduce the provider-capability seam.
  2. Keep OpenAI behavior unchanged behind that seam.
  3. Add one non-OpenAI direct-only path only if the wave-1 study still needs it.
- **Outputs:** provider-layer requirements doc
- **Verification:** provider support can widen without changing the scientific scope of the first paper
- **Risks/Assumptions:** if throughput depends on batching, this phase must split into a separate effort
- **Confidence:** `0.55`

### S5: Package The Wave-1 Study Assets

- **Objective:** Produce the planning assets needed to move from research to implementation.
- **Evidence to Review:** `k_005`, `k_002`, `k_003`, `k_004`
- **Inputs:** all deliverables under `deliverables/`
- **Actions:**
  1. finalize the wave-1 study matrix
  2. finalize the paper outline
  3. write the implementation requirements docs as the handoff package
- **Outputs:** planning handoff package
- **Verification:** the package can be used to scope implementation work without reopening the core study-design question
- **Risks/Assumptions:** some target-specific artifacts still need inspection before implementation begins
- **Confidence:** `0.83`

---

## 8. Validation Gates

1. **Scope Gate:** wave 1 can be explained as one flagship paper-audit story.
2. **Evidence Gate:** the minimal substrate covers the chosen flagship audit without comparator-style structured payloads.
3. **Acquisition Gate:** discovery and hydration are separate contracts before Firecrawl search is removed.
4. **Runner Gate:** the chosen audit does not force a generic StagePlan in wave 1.
5. **Provider Gate:** any non-OpenAI support is direct-only unless throughput explicitly proves otherwise.
6. **Target Gate:** flagship audit materials remain sufficient for faithful reconstruction.

---

## 9. Open Questions

- Is `Gilardi` definitively the wave-1 spine, or does the team still want a near-term two-target paper?
- Does the chosen audit require richer structured evidence than the current minimal substrate assumes?
- Is Media Cloud-only discovery enough for the first wave, or does wave 1 need a second fetcher beyond Firecrawl-as-hydrator immediately?
- Is Anthropic or OpenRouter the more useful first non-OpenAI direct-only slice?
- Should contested-concept geometry appear in the paper body or only as context and future work?

---

## 10. Deliverables

- `deliverables/01_evidence_window_schema_plan.md`
- `deliverables/02_provider_runtime_support_plan.md`
- `deliverables/03_experiment_prompt_surface_plan.md`
- `deliverables/04_v4_self_contained_study_plan.md`
- `deliverables/05_phased_roadmap.md`
- `deliverables/06_v4_paper_outline.md`
- `deliverables/07_mediacloud_source_replacement_plan.md`

---

## Appendix: Sources

- `knowledge/k_001_repo_baseline_evidence.md`
- `knowledge/k_002_evidence_schema_evidence.md`
- `knowledge/k_003_provider_runtime_evidence.md`
- `knowledge/k_004_experiment_surface_evidence.md`
- `knowledge/k_005_study_scope_evidence.md`
- `knowledge/k_006_mediacloud_source_evidence.md`
- `null_challenges/nc_v4_scope_challenge.json`
- `certainty/certainty_report.md`
