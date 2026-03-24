# V4 Evidence Schema Refactor Plan (Scope: Evidence + Window Model Only)

## Why The Current Window/Evidence Model Is Too Narrow

The current core object (`evidences`) is implicitly "a news article collected by a Firecrawl window run":

- **Evidence is run-bound and article-shaped.** Every `evidences` row requires `window_id` + `window_run_id`, and assumes `title` + `url` + markdown `l0_raw_content`. This breaks for imported datasets that are not URLs, not articles, and not collected by search (e.g., paper audit corpora, benchmark prompts/responses, labeled survey items).
- **Source surface is hard-coded and not extensible.** `windows.source_provider` is currently `enum(["firecrawl"])`, so "evidence origin" is not a first-class concept, it is a single fixed pathway.
- **Derived representations are baked into one table shape.** `l1/l2/l3` are columns on the evidence row with attempt/error refs. That locks the system into one linear transformation pipeline (clean -> neutralize -> abstract) and makes it hard to:
  - run multiple transformation policies (different prompts/versions) side-by-side,
  - support dataset-specific "views" (e.g., excerpting, translation, de-identification),
  - re-run derivations without rewriting history.
- **Provenance is thin.** Beyond window query/country/date range and a URL, there is no durable dataset citation/license surface suitable for paper-audit targets (Gilardi / Ziems / Zheng) where replication requires dataset versioning and stable external IDs.
- **Windows conflate (a) a sampling definition, (b) an import job, and (c) a transformation job.** `window_runs` is the executable process, but it is tied to the "news window" world; V4 needs imports that are not "search windows" at all.

Net: the current model is appropriate as a *news collection convenience*, but too narrow as the V4 evidence substrate.

## V4 Core Entities + Relationships

Design goals:

- A single **EvidenceUniverse** that can hold both news-collected evidence and imported benchmark/paper datasets.
- **Evidence provenance** and **import execution** are explicit (for auditability/reproducibility).
- **Derived views** are separate versioned artifacts, not hard-coded columns.
- Existing **bundle_plans** remain the primary "measurement instrument" abstraction, but should attach to a universe-backed evidence set rather than to "window-run articles only".

### Entity: `EvidenceUniverse` (replaces "article-only pool semantics")

Represents a named, citable evidence collection suitable for reuse across experiments/bundle plans.

Proposed fields:

- `universe_tag` (string, unique): stable human identifier.
- `kind` (enum): `news_corpus | imported_dataset | synthetic | mixed`.
- `title` (string), `description` (string, nullable).
- `citation_json` (string, nullable): BibTeX-like or CSL JSON, stored as text (consistent with existing `*_json` patterns).
- `license_json` (string, nullable): license name + URL + restrictions.
- `created_at_ms` (number).

Constraints/indexes:

- Unique index on `universe_tag`.

Relationship:

- One universe has many sources, sampling frames, and evidence items.

### Entity: `EvidenceSource` (where items came from)

Represents a provenance root: "Firecrawl news search", "GitHub-hosted dataset release", "manual curated list", "paper supplementary material".

Proposed fields:

- `universe_id` (fk).
- `source_tag` (string, unique within universe).
- `source_kind` (enum): `news_search | dataset_import | manual | api | other`.
- `provider` (string, nullable): e.g., `firecrawl`, `openalex`, `s3`, `github_release`.
- `citation_json` (string, nullable): source-specific citation.
- `license_json` (string, nullable).
- `metadata_json` (string, nullable): source configuration/version hashes, retrieval params, checksums.

Constraints/indexes:

- Unique `(universe_id, source_tag)`.

### Entity: `SamplingFrame` (generalizes the "window definition" concept)

Represents a *definition* for acquiring/constructing evidence items (not necessarily news search).

Proposed fields:

- `universe_id` (fk), `source_id` (fk).
- `frame_tag` (string, unique within universe).
- `frame_kind` (enum): `news_window | dataset_split | dataset_filter | manual_list | other`.
- `spec_json` (string): the frame definition. Examples:
  - `news_window`: `{ query, country, start_date, end_date, source_provider }`
  - `dataset_split`: `{ dataset_name, dataset_version, split }`
  - `dataset_filter`: `{ where: ..., limit: ... }`

Constraints/indexes:

- Unique `(universe_id, frame_tag)`.

### Entity: `ImportJob` (generalizes the "window run" concept)

Represents a *single execution* that materializes items into the universe (import/collection), independent from any derived-view pipeline.

Proposed fields:

- `universe_id` (fk), `source_id` (fk), `frame_id` (fk).
- `status` (enum like existing `StateStatusSchema`): `start|queued|running|paused|completed|error|canceled`.
- `started_at_ms`, `finished_at_ms` (nullable).
- `target_count` (int, nullable), `completed_count` (int).
- `last_error_message` (string, nullable).
- `external_job_ref` (string, nullable): for provider/job IDs (optional).
- `metadata_json` (string, nullable): importer version, checksums, dedupe behavior.

Constraints/indexes:

- Index by `(frame_id, status)`; index by `(universe_id, started_at_ms)` for audit/history.

### Entity: `EvidenceItem` (replaces `evidences` as the canonical atomic unit)

Represents one thing that can be shown to judges (textual by default) with stable provenance and stable external IDs.

Proposed fields:

- `universe_id` (fk), `source_id` (fk), `import_job_id` (fk, nullable).
- `external_id` (string, nullable): dataset row ID, paper ID, etc. (required for imported datasets).
- `url` (string, nullable), `url_normalized` (string, nullable).
- `title` (string, nullable).
- `content_text` (string): the canonical raw text payload for the item (for news: markdown; for benchmarks: rendered prompt/turns).
- `content_hash` (string): sha256 (or existing content hash convention) for dedupe and reproducibility.
- `language` (string, nullable).
- `published_at` (string, nullable): ISO date/time when meaningful.
- `metadata_json` (string, nullable): labels, splits, topical tags, author/venue, prompt/response structure, etc.
- `created_at_ms` (number).

Constraints/indexes (recommended):

- Unique `(source_id, external_id)` when `external_id` is present.
- Unique `(source_id, url_normalized)` when present (news-like evidence).
- Index by `universe_id`.
- Index by `content_hash` (for dedupe and joins).

### Entity: `EvidenceItemView` (derived representations; replaces fixed `l1/l2/l3` columns)

Represents a view/representation of an `EvidenceItem`, produced by some deterministic or LLM pipeline.

Proposed fields:

- `evidence_item_id` (fk).
- `view_kind` (string): initially align with V3 semantics: `l0_raw|l1_cleaned|l2_neutralized|l3_abstracted`. Keep open to future view kinds without schema churn.
- `pipeline_kind` (string): e.g., `clean`, `neutralize`, `abstract`, `translate`, `excerpt`.
- `pipeline_version` (string): prompt/policy version tag (required for reproducibility).
- `status` (enum): `succeeded|failed|pending` (or reuse a small status enum).
- `content_text` (string, nullable): present when succeeded.
- `content_hash` (string, nullable).
- `llm_attempt_id` (fk `llm_attempts`, nullable): for LLM-derived views.
- `error_message` (string, nullable).
- `created_at_ms` (number).

Constraints/indexes:

- Unique `(evidence_item_id, view_kind, pipeline_version)` to prevent accidental overwrites.
- Index by `(evidence_item_id, view_kind)` for fast "get latest view" reads.

## What Replaces Windows vs What Stays A News Convenience Layer

### Replace (generalize)

- **Canonical evidence identity** moves from `evidences` (window-run rows) to `EvidenceItem` (universe-scoped, source-aware).
- **Window-run-as-import** generalizes to `ImportJob` with `SamplingFrame` as the stable definition.
- **L0-L3 view storage** moves from columns to `EvidenceItemView` (versioned, extensible).

### Remain specialized (news collection convenience)

Keep `windows` and `window_runs` as a first-class *special-case importer* for `SamplingFrame.frame_kind = news_window`:

- The current Firecrawl search semantics (query/country/date/tbs) are highly specific and should stay in `domain/window/*`.
- `windows` and `window_runs` can remain as thin shims that:
  - define a `SamplingFrame`-equivalent spec (or are mapped 1:1 to a `SamplingFrame` row),
  - produce an `ImportJob` row (or are mapped 1:1 to one),
  - write `EvidenceItem` rows (not `evidences` as the canonical store) and then schedule derived-view jobs.

This preserves operational stability of the Temporal window workflow while unlocking non-window imports.

## Migration + Sequencing Guidance (Compatibility First)

### What to change first

1. **Add new universe/source/item/view tables without deleting anything.**
2. **Backfill from existing `windows/window_runs/evidences` into the new tables** as a one-time migration step (or incremental dual-write during a transition period).

Backfill mapping:

- `windows` -> `SamplingFrame(frame_kind=news_window, spec_json={...})` and `EvidenceSource(source_kind=news_search, provider=firecrawl)`
- `window_runs` -> `ImportJob(frame_id=..., status=..., counters/errors=...)`
- `evidences` -> `EvidenceItem(content_text = l0_raw_content, url/title = existing, metadata_json includes legacy ids)`
- `l1/l2/l3` columns -> `EvidenceItemView(view_kind=l1_cleaned|l2_neutralized|l3_abstracted, llm_attempt_id=..., error_message=...)`

### What can be shimmed

- Keep the existing `evidences` table and continue to serve V3/V3.5 code paths from it while V4 code reads `EvidenceItem`/`EvidenceItemView`.
- For a period, implement a **dual-write** for new window collections:
  - write the legacy `evidences` row (for existing run/bundle tooling),
  - write the new `EvidenceItem` + `EvidenceItemView` rows (for V4 imports and view versioning).

### What should not be generalized yet

- **Bundle strategies that depend on `window_id`** (e.g., `window_round_robin`) should not be generalized prematurely.
  - Near-term: keep using `windows` as the grouping dimension for news; for imported datasets, either:
    - avoid `window_round_robin` (use `random_bundle` / semantic clustering), or
    - introduce a minimal "group key" concept later (e.g., `EvidenceItem.group_key` or `SamplingFrame`-based grouping) once requirements are clear.
- **Semantic levels beyond `l0..l3`**: keep `SemanticLevelSchema` as the experiment-facing control for now; allow extra `view_kind`s only as internal future extensibility.

## How This Supports Both V4 Lanes

### Contested-concept studies (news-derived corpora)

- Universe: `EvidenceUniverse(kind=news_corpus)` per study slice (or per country/time slice).
- Collection: `windows/window_runs` remain the primary operational path, but materialize into `EvidenceItem` rows.
- Views: keep the existing L0-L3 pipeline as `EvidenceItemView` rows, version-tagged to the prompt/policy used.
- Bundles: `bundle_plans` remain first-class plans defined over an evidence set in the universe; `source_view` keeps selecting the semantic view shown to judges.

### Paper-audit targets (Gilardi / Ziems / Zheng-style imports)

- Universe: `EvidenceUniverse(kind=imported_dataset)` per imported paper dataset, with citation/license metadata.
- Source: `EvidenceSource(source_kind=dataset_import, provider=github_release|doi|... )` with dataset version hashes/checksums in `metadata_json`.
- Frame: `SamplingFrame(frame_kind=dataset_split, spec_json={split:"train"|"test"|...})` or `dataset_filter`.
- Import: `ImportJob` records the ingest and dedupe policy.
- Items: `EvidenceItem.external_id` is required; `metadata_json` carries paper-provided labels, strata, or paired-output structure.
- Views: optional; for many benchmarks, `l0_raw` may be sufficient, but the model supports adding `excerpt`/`deid`/`translate` views when needed.

## Recommended Implementation Sequence (Short)

1. Add `EvidenceUniverse`, `EvidenceSource`, `SamplingFrame`, `ImportJob`, `EvidenceItem`, `EvidenceItemView` tables and indexes.
2. Backfill all existing `windows/window_runs/evidences` into the new structure (plus dual-write for new window collections).
3. Introduce a V4-only read surface that prefers `EvidenceItem` + `EvidenceItemView` (keep V3 paths on legacy tables).
4. Only after V4 imports exist: revisit bundle-plan attachment to the new universe-backed evidence sets and decide whether to generalize the `window_id` grouping dimension.

## Risks + Open Questions

- **Dedupe semantics:** for news, URL normalization is imperfect; for datasets, `(source_id, external_id)` is reliable. The schema should support both without accidental cross-source collisions.
- **Storage growth:** splitting views into rows increases write volume; content blobs may need future compression or externalization if corpora scale.
- **Reproducibility vs mutability:** decide whether `EvidenceItem.content_text` is immutable (recommended) and whether fixes create a new item vs a new view/version.
- **Bundle grouping dimension:** imported datasets may need a general "stratum/group" concept (topic, source, split) analogous to `window_id`.
- **License/quote constraints:** paper datasets may have redistribution constraints; the schema needs a first-class license field, but enforcement is an application concern.

