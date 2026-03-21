# Window / Evidence Process Decomposition (Raw vs Semantic Views)

**Confidence:** 0.72

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/models/window.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/window/window_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/window/evidence_search.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/window/evidence_prompts.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/models/bundles.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/bundle_plan_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/bundle_plan_logic.ts
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md
- https://community.temporal.io/t/purpose-of-child-workflows/652
- https://community.temporal.io/t/optimizing-workflow-archival/3270

## Summary

### What Exists Today

The current engine stores raw scraping + semantic transforms in a single evidence row:
- `windows`: query/country/date range + a single `model`, plus process status and workflow binding.
- `evidences`: `l0_raw_content` plus nullable `l1_cleaned_content`, `l2_neutralized_content`, `l3_abstracted_content`, each with `*_attempt_id` and `*_error_message`. This encodes one transform pipeline per evidence row. ([window.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/models/window.ts))

Window collection is currently coupled to the window entity:
- Firecrawl search action produces `{title,url,raw_content}`.
- A mutation inserts evidence rows with `l0_raw_content` populated. ([evidence_search.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/window/evidence_search.ts), [window_repo.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/window/window_repo.ts))

Semantic bundling/clustering is currently derived from evidence content at a chosen *semantic level*:
- `bundle_plans` define a strategy + `source_view` (semantic level) + size/seed and materialize `bundle_plan_items`.
- `semantic_cluster` uses TF-IDF tokenization + cosine similarity on the selected content for `source_view`, and `semantic_cluster_projected` prefers `l2_neutralized`. ([bundle_plan_logic.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/bundle_plan_logic.ts), [bundle_plan_repo.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/runs/bundle_plan_repo.ts))

### Why This Becomes A Problem For Pilot-Scale Iteration

For the pilot, you want:
- start/stop/pause-like semantics on “scrape” vs “semantic cleaning”
- the ability to run semantic cleaning under different models or different prompt contracts
- to build bundle plans/clusters against a stable, named semantic view

The current schema makes that hard because:
1. The window has a single `model` field, implicitly “the model that created all semantic transforms,” which blocks multiple transform variants.
2. Each evidence row can hold only one `l1/l2/l3` pipeline output; you can’t keep multiple competing semantic views without either overwriting or copying evidence rows.
3. Bundle planning’s `source_view` points only at a semantic level (e.g. `l2_neutralized`), not at a semantic view *variant* (model + instructions version + prompt template version + parameters). That undermines scientific comparability when you want “cluster on L2 produced by pipeline X.”

### Recommended Decomposition (Minimum That Unlocks The Pilot)

Keep *collection* and *semantic transformation* as separate processes and separate storage surfaces.

#### 1) Treat window as “collection config + raw evidence snapshot”

Keep `windows` as the raw-collection process:
- `query`, `country`, `start_date`, `end_date`, `target_count`
- collection `status`, `workflow_id` / `workflow_run_id`
- remove or de-emphasize `windows.model` as “the semantic model,” because collection isn’t model-specific

Keep `evidences` as the immutable raw evidence store:
- keep `l0_raw_content`, `title`, `url`, `window_id`
- do *not* store semantic outputs on `evidences` long term (or treat them as legacy/default view only)

#### 2) Add an explicit semantic view/pipeline layer

Introduce a new table for semantic transforms, keyed by evidence + pipeline identity:

Option A (normalized, simplest to reason about):
- `evidence_pipelines`: pipeline identity and contract
  - `pipeline_tag` (stable name)
  - `model`
  - `prompt_template_ids` for L1/L2/L3 (or one versioned bundle)
  - `created_at`, `status`
- `evidence_pipeline_items` (or `evidence_views`): per-evidence outputs
  - `evidence_id`, `pipeline_id`
  - `l1_content`, `l2_content`, `l3_content`
  - `l1_attempt_id`/`l2_attempt_id`/`l3_attempt_id`
  - per-stage error fields

Option B (less normalized, fewer tables):
- `evidence_views` row per `(evidence_id, pipeline_tag)` and a `level` field, storing content per level.

The key is that the *pipeline identity* becomes first-class, not implied.

#### 3) Make bundle plans reference a pipeline identity (not just a level)

Today, bundle plans can choose a `source_view` level. For pilot scientific hygiene, you want:
- `bundle_plan.source_view` (semantic level) + `bundle_plan.source_pipeline_id` (or `pipeline_tag`)
so “cluster on L2” means “cluster on the L2 from pipeline P,” not “whatever L2 happens to be on the evidence row.”

This keeps “pool freeze” and “bundle materialization” comparable across experiments even when you re-run semantic cleaning.

### Temporal Execution Implications

Once you split the processes, the Temporal side becomes clearer:
- `WindowWorkflow` is bounded: scrape + insert raw evidence + stop. You can add pause-after at “collect” but this is mostly bounded anyway.
- “semantic cleaning” becomes its own workflow (`EvidencePipelineWorkflow`) that can be paused, resumed, and restarted independently, and can be re-run for the same raw evidence set under a new pipeline identity.

If you expect very large windows/pipelines, Temporal history pressure becomes relevant:
- a single workflow has an event-history limit; child workflows can partition work (e.g., a child per chunk of evidence ids) to keep histories bounded. Temporal recommends starting with a single workflow if bounded, then partitioning only when size/history requires it. (Temporal community guidance: child workflows are for partitioning workloads and avoiding large history; continue-as-new resets history for long-running workflows.) (https://community.temporal.io/t/purpose-of-child-workflows/652, https://community.temporal.io/t/optimizing-workflow-archival/3270)

### Counterpoints / Uncertainty

- If windows are always small and you never need multiple semantic view variants, the extra tables add complexity for little gain.
- Storing one “default pipeline” on `evidences` can be pragmatic for UI, but it should be treated as a cached view, not the scientific source of truth.
- Bundle clustering today is TF-IDF-based; if you later move to embedding-based clustering, the pipeline identity becomes even more important (embedding model/version becomes part of the contract).

## Practical Pilot-Readiness Checklist (for this decomposition)

Before changing schema, confirm:
- You truly need multiple semantic pipelines per raw evidence set (likely yes, given the planned ablations and the desire to gate/pause semantic cleaning).
- You want to rebuild bundle plans against pipeline-specific semantic views rather than “whatever is on evidence.”
- You have a naming/versioning scheme for pipelines that will survive the debug loop (template IDs + explicit pipeline tags).

