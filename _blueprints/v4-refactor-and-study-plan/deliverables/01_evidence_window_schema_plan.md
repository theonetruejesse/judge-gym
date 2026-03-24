# Evidence And Window Schema Plan

## Recommendation

Treat the current `windows -> window_runs -> evidences` path as a specialized news-ingestion layer, not as the permanent V4 evidence substrate.

For wave 1, do **not** attempt the full long-run generalized schema in one cut. Instead, land a minimal import-ready evidence core with these invariants:

- stable per-item identity for imported audit datasets
- immutable raw payload for each imported item
- explicit rendered view used for each judgment
- explicit provenance pointing back to the imported source bundle or current window source

## Wave-1 Core Objects

1. `evidence_sets`
   - one row per reusable audit corpus or imported bundle
   - carries source citation, provenance summary, and version identity

2. `evidence_items_v4`
   - one row per canonical item
   - required fields:
     - `evidence_set_id`
     - `external_id`
     - `raw_payload`
     - `payload_kind`
     - `content_hash`
     - `provenance_json`

   For Media Cloud-backed discovery, this row should either:
   - carry a pointer to the discovered candidate row, or
   - directly preserve the upstream candidate metadata needed for audit and replay

3. `evidence_item_views_v4`
   - one row per rendered or transformed view used by a run
   - required fields:
     - `evidence_item_id`
     - `view_kind`
     - `view_version`
     - `rendered_text`
     - `derivation_metadata_json`

4. `evidence_candidates_v4`
   - optional but strongly recommended if Media Cloud becomes the primary discovery layer
   - required fields:
     - `discovery_provider`
     - `external_id`
     - `url`
     - `title`
     - `candidate_metadata_json`

## Keep As A Specialized Convenience Layer

- `windows`
- `window_runs`
- Firecrawl-specific collection logic

Those should remain the operational news-collection path and either:

- feed the new V4 evidence core for new work, or
- continue serving legacy V3 paths while the new audit lane uses the new core

## Explicit Deferrals

Defer unless wave-1 implementation proves they are necessary:

- generalized `SamplingFrame`
- generalized `ImportJob`
- full dual-write across every legacy path
- generalized grouping strata beyond what bundle plans already need

What is **not** deferred:

- the distinction between discovered candidates and hydrated raw content, if Media Cloud becomes the query surface

## Why This Cut

The long-run architecture from the research lane is directionally correct, but the falsifier is right that six new tables plus backfill plus dual-write would likely become the paper’s critical path. The wave-1 version should solve the audit-import problem first, not all future ingestion problems.
