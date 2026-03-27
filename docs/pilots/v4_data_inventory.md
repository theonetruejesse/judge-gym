# V4 Data Inventory

This document is the organizational split for the current V4 study surface.

It separates:

1. the live paper-audit launch data we have already created and run,
2. the local source/build artifacts that feed those runs,
3. the native conceptual-study lane that we can start next,
4. and the catalog issues we should keep in view before broadening the provider panel.

The machine-readable export lives in [_local/v4_inventory/live_inventory.json](/Users/jesselee/dev/research/jg/judge-gym/_local/v4_inventory/live_inventory.json) and the generated quick summary lives in [_local/v4_inventory/live_inventory.md](/Users/jesselee/dev/research/jg/judge-gym/_local/v4_inventory/live_inventory.md).

## Current Study Buckets

### Paper-Audit Lane

This is the live V4 wave-1 lane.

- `Gilardi`
- `Zheng / MT-Bench`

These are already imported, packaged, launched, and analyzed in own-dev. The live experiment rows are the source of truth for this lane, and the analysis/rerun artifacts under [_deep_workflows/v4-launch-r04](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-launch-r04) and [_deep_workflows/v4-launch-r05](/Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-launch-r05) are the current read on what is stable.

### Local Source And Build Lane

This is the reproducible local-input layer.

- Gilardi source bundle under [_local/v4_sources/gilardi](/Users/jesselee/dev/research/jg/judge-gym/_local/v4_sources/gilardi)
- Zheng source bundle under [_local/v4_sources/zheng](/Users/jesselee/dev/research/jg/judge-gym/_local/v4_sources/zheng)
- Built import/package artifacts under [_local/v4_builds](/Users/jesselee/dev/research/jg/judge-gym/_local/v4_builds)

These are ready and do not need more work before native conceptual studies.

### Native Conceptual-Study Lane

This is the next lane, but it is not instantiated yet.

What is runnable now:

- Media Cloud acquisition on Temporal into a native `evidence_universe`
- curation into `evidence_sets`
- raw/source-text versus semantic-view comparisons
- `window_round_robin` bundled runs
- `random_bundle` bundled runs
- GPT-4.1-first native runs using the same evidence-set-backed experiment substrate as the paper-audit lane

What is not ready yet:

- `semantic_cluster`
- `semantic_cluster_projected`
- a frozen conceptual manifest for contested-concept targets
- native package/build scripts comparable to the Gilardi/Zheng builders

So the answer is yes: we can run the conceptual setups too, but the right next step is a **native conceptual manifest + curated evidence universe**, not broader provider expansion.

## Recommended Data Separation

Going forward, the repo should treat these as three distinct inventories:

### `paper_audit_live`

Contains:

- live Convex experiments
- live evidence sets
- paper-audit packages
- launch/rerun findings

### `paper_audit_local`

Contains:

- downloaded source bundles
- built import bundles
- package JSON
- headline bundle JSON

### `native_conceptual_queue`

Contains:

- conceptual-study manifests
- candidate Media Cloud acquisition specs
- curated evidence-set definitions
- launch queue for GPT-4.1-only conceptual baselines/interventions

This keeps us from mixing literature-audit evidence with native conceptual-study preparation.

## Immediate Queue

Before spending budget on more provider families, the next native conceptual queue should be:

1. freeze a single conceptual-study manifest
2. create one Media Cloud-backed evidence universe
3. curate one frozen evidence set
4. run GPT-4.1 baseline
5. run GPT-4.1 abstention
6. run GPT-4.1 raw/source-text versus `l2_neutralized`
7. if bundle-sensitive work is included, keep it to `window_round_robin` or `random_bundle`

That is the clean bridge from the current paper-audit launch to the broader `judge-gym` conceptual program.

## Catalog Issues To Keep In View

The inventory export currently flags a few catalog anomalies in own-dev:

- duplicate `gilardi_relevance_v1` universe tags
- duplicate `gilardi_relevance_v1_canary_set` evidence-set tags
- one GPT-4.1 Zheng baseline experiment row with multiple completed runs because of the pre-hardening canary/baseline tag collision
- universe/set count mismatches on the duplicate Gilardi canary rows

These do not block the current paper-audit results, but they are exactly why we needed an explicit inventory surface before expanding the launch scope.
