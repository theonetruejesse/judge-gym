# Execution Surface Audit

## Already Implemented

- The evidence substrate is V4-native:
  - `evidence_universes`
  - `evidence_sets`
  - `evidence_set_items`
  - `evidence_source_records`
  - `evidence_views`
  - `evidence_transform_runs`
- Direct paper-style import already exists through `apps/engine-convex/convex/packages/evidence.ts`.
- Experiment contracts already expose the key V4 knobs:
  - `study_kind`
  - `evidence_source_kind`
  - `rubric_source_kind`
  - `compatibility_mode`
  - `task_contract`
  - `output_contract`
- Evidence-set-backed run materialization is already live in `apps/engine-convex/convex/domain/runs/run_repo.ts`.
- The current engine can resolve:
  - `paper_original`
  - `source_text`
  - semantic views such as `l2_neutralized`
- There is already a substrate smoke harness at `apps/engine-convex/scripts/v4_smoke.ts`.

## What The Current Substrate Proves

- We can import evidence directly into a paper-audit universe and evidence set.
- We can pin source records or semantic views per evidence-set item.
- We can register paper-audit experiments with non-pilot task and output contracts.
- We can materialize score targets from evidence sets rather than legacy windows or pools.

## What Is Not Yet Cleanly Productized

### 1. Paper-Audit Packaging Registry

The schema can express:

- `rubric_source_kind = imported_rubric | imported_codebook | direct_labels`
- `task_contract.prompt_template_id`
- `task_contract.instructions_json`
- `task_contract.label_space_json`

But there is not yet a first-class control-plane object for a paper audit package that freezes:

- paper target identity
- dataset slice identity
- rubric or codebook artifact
- prompt template identity
- label space
- output contract
- provenance and freeze metadata

Today those values can be passed ad hoc through experiment config. That is enough for tests, but too loose for repeatable paper-faithful canaries.

### 2. Target Import Adapters

The engine has a generic `importEvidenceItem` path, but not dedicated import adapters for:

- `Gilardi`
- `Zheng / MT-Bench`
- `Ziems` follow-on

That means target canaries are still manual unless we add import scripts or package loaders per target.

### 3. Prompt-Template Provenance Layer

Run-time attempt logging hashes the generated system prompt into `llm_prompt_templates`, but `task_contract.prompt_template_id` is currently just a string-level contract. There is no first-class registry that ties a paper-fidelity template id to a stored audited template bundle.

### 4. Bundle Strategy Support On Evidence Sets

Evidence-set-backed runs currently support:

- `window_round_robin`
- `random_bundle`

They explicitly do not yet support:

- `semantic_cluster`
- `semantic_cluster_projected`

So bundle-sensitive appendix work is still blocked on clustering support for evidence-set-backed runs.

### 5. Target-Specific Canaries

`bun run v4:smoke` verifies the substrate, but it does not yet verify the headline study design because it:

- uses `rubric_source_kind = generate`
- uses `compatibility_mode = native`
- uses a small internal fixture instead of imported target artifacts
- does not include the OpenRouter/Qwen lane

## Strong-Conviction Read

We should not just swap in paper evidence and rubrics at run time. We should:

1. import evidence into the V4 evidence substrate
2. package the paper contract into a frozen paper-audit bundle
3. instantiate a `paper_faithful` experiment against that package
4. run target canaries before matrix expansion
