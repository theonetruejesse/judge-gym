# judge-gym

Open-source LLM-as-judge regime engine.

The repo is now a greenfield V4 system. The old window / `window_runs` / `evidences` / Firecrawl path is gone. Evidence acquisition is Media Cloud-first, storage-backed, and evidence-set-driven.

## Stack

- `apps/engine-convex`: Convex backend, schema, worker APIs, evidence acquisition, experiment/run orchestration
- `apps/engine-temporal`: Temporal worker for `RunWorkflow` and semantic evidence transforms
- `apps/lab`: Next.js UI for evidence universes, evidence sets, and experiments
- `packages/engine-settings`: shared provider/runtime settings
- `packages/engine-prompts`: shared run prompt/config contracts
- `apps/analysis`: Python analysis/export consumers

## Current Architecture

### Evidence

The evidence path is:

1. create an `evidence_universe`
2. define an `acquisition_spec`
3. execute an `acquisition_run`
4. ingest Media Cloud discovery into `evidence_candidates`
5. hydrate candidates into canonical `evidence_items`
6. persist original documents as `evidence_source_records`
7. execute `evidence_transform_runs` to generate semantic/derived `evidence_views`
8. freeze reusable `evidence_sets`

Large payloads live in Convex storage and are referenced through `evidence_assets`.

Core tables:

- `evidence_universes`
- `acquisition_specs`
- `acquisition_runs`
- `evidence_candidates`
- `evidence_items`
- `evidence_source_records`
- `evidence_views`
- `evidence_transform_runs`
- `evidence_assets`
- `evidence_sets`
- `evidence_set_items`

### Experiments

Experiments are evidence-set-native.

- `packages/lab:initExperiment` requires `evidence_set_id`
- experiments store V4 study metadata:
  - `study_kind`
  - `evidence_source_kind`
  - `rubric_source_kind`
  - `compatibility_mode`
  - `task_contract`
  - `output_contract`
- run creation freezes score-target inputs from `evidence_set_items`
- score-stage prompt building reads storage-backed content assets

### Runtime

Live workflows:

- `RunWorkflow` with:
  - `rubric_gen`
  - `rubric_critic`
  - `score_gen`
  - `score_critic`
- `EvidenceTransformWorkflow` with:
  - `l1_cleaned`
  - `l2_neutralized`
  - `l3_abstracted`

Semantic transforms now read from `evidence_source_records` and write back into `evidence_views`. Raw/paper-original source records stay decoupled from the semantic ladder.

Provider support:

- OpenAI direct + native batch
- Anthropic direct + native batch
- OpenRouter direct

Batch/provider lifecycle is persisted in `llm_batch_executions`, including provider-specific artifacts such as Anthropic batch `results_url`.

## Lab UI

The lab now has two primary authoring surfaces:

- `/editor/evidence`: Media Cloud query form for creating evidence universes and frozen evidence sets
- `/editor/experiment`: experiment creation from curated evidence sets

The home page lists:

- experiments
- evidence universes

The evidence detail page inspects:

- acquisition runs
- evidence sets
- universe items
- source records / raw storage-backed content
- generated views
- transform coverage per evidence set
- semantic transform run launch + progress

## Validation

After Convex changes:

- `bun run validate:convex`

Useful checks:

- `bun run typecheck`
- `cd apps/engine-convex && bun run test -- evidence_package evidence_repo worker_idempotency telemetry_observability`
- `cd apps/engine-temporal && bun run test`

Smoke flow:

- `cd apps/engine-convex && bun run v4:smoke`

## Development Notes

- Root `.env.local` is the source of truth
- Use `bun install` from repo root
- Deploy the Temporal worker after runtime-affecting worker changes before resuming real external runs

## Debug Surfaces

Convex debug packages:

- `packages/codex:getProcessHealth`
- `packages/codex:getStuckWork`
- `packages/codex:autoHealProcess`
- `packages/codex:tailTrace`
- `packages/codex:analyzeProcessTelemetry`
- `packages/codex:listBatchReconciliationStatus`

CLI wrappers:

- `bun run debug:watch -- --run <run_id>`
- `bun run debug:stuck`
- `bun run debug:heal -- --run <run_id>`
- `bun run debug:tail -- --run <run_id>`
- `bun run debug:analyze -- --run <run_id>`
- `bun run debug:batches -- --run <run_id>`

## What Was Removed

Removed from the live repo path:

- `windows`
- `window_runs`
- `evidences`
- Firecrawl-backed discovery
- pool and bundle-plan experiment inputs
- `WindowWorkflow`
- window-specific lab/editor flows

Historical V3 materials still exist under docs, campaigns, and analysis artifacts where they are part of research history, but they are no longer runtime dependencies.
