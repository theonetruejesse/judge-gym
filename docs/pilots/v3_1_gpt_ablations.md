# V3.1 - GPT Ablations Follow-Up Plan

This document plans the narrow V3.1 follow-up after freezing the current V3 pilot in [v3_gpt_ablations.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md).

The goal is not to rerun the whole matrix. The goal is to resolve the specific uncertainties that V3 surfaced:

1. whether the `a6/a7` bundle results were real or partly a clustering artifact,
2. whether `l3` becomes more informative once clustering is standardized,
3. whether `gpt-4.1-mini` and `gpt-5.2-chat` behave like scaled-down copies of the main models,
4. whether scale size remains an expressivity lever in the smaller/chat families.

The existing V3 clustering families stay in the record. V3.1 adds a new corrected iteration rather than replacing those runs.

## Keep From V3

These V3 results are already strong enough and do not need to be rerun in V3.1:

- `a1` abstention toggle
- `a4` rubric/scoring model-role swap
- `a5` concept swap

These remain frozen findings from V3.

## V3.1 Scope

V3.1 should stay small. The proposed follow-up matrix is **14 new experiments**:

- 6 mainline clustering/abstraction experiments
- 4 small-model extension experiments
- 4 high-scale clustered probes

This is enough to answer the open questions without reopening the entire pilot.

## Required Spec Changes Before Launch

V3.1 should not run on the old clustering surface. Before launch, add explicit experiment/config metadata for bundle construction so matching can be validated later in analysis.

### Must-have

- `bundle_strategy`
  - `semantic_cluster_k`
  - `random_bundle_k`
- `bundle_strategy_version`
- `clustering_seed`
- stable `cluster_id`
- stable `bundle_signature`
- exported `source_window_ids` for every bundled response

### Strongly Recommended

- export `response_items` in analysis
  - one row per `(response_id, evidence_id)`
- export `cluster_id` and `bundle_signature` in analysis manifests / response rows
- export `prompt_family` or `template_version`

Without the first set, V3.1 will repeat the `a6/a7` matching failure in a cleaner-looking form.

## Proposed Experiment Matrix

### Family C1: Clustering Repair

Purpose:
- isolate the effect of bundle construction,
- separate semantic clustering from random bundling,
- retest `l3` under stable matched cluster assignments.

All of these should use:

- `concept = fascism`
- `abstain_enabled = true`
- `scoring_method = subset`
- `evidence_bundle_size = 5`
- the current rubric randomization package

#### New experiments

| Tag | Model | Evidence View | Bundle Strategy | Why |
| --- | --- | --- | --- | --- |
| `v3_1_c1_gpt_4_1_bundle_5_random_l2` | `gpt-4.1` | `l2_neutralized` | `random_bundle_5` | Random-bundle baseline for grouping effects |
| `v3_1_c1_gpt_5_2_bundle_5_random_l2` | `gpt-5.2` | `l2_neutralized` | `random_bundle_5` | Same as above for `gpt-5.2` |
| `v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2` | `gpt-4.1` | `l2_neutralized` | `semantic_cluster_5` | Corrected semantic-cluster rerun of `a6` |
| `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2` | `gpt-5.2` | `l2_neutralized` | `semantic_cluster_5` | Corrected semantic-cluster rerun of `a6` |
| `v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2` | `gpt-4.1` | `l3_abstracted` | `semantic_cluster_5_projected` | Corrected semantic-cluster rerun of `a7` |
| `v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2` | `gpt-5.2` | `l3_abstracted` | `semantic_cluster_5_projected` | Corrected semantic-cluster rerun of `a7` |

### Family C4: Small-Model Extensions

Purpose:
- determine whether the small/chat models behave like downscaled versions of the mainline pair,
- test whether scale-size and clustering effects generalize.

All of these should use:

- `concept = fascism`
- `abstain_enabled = true`
- `scoring_method = subset`

#### New experiments

| Tag | Model | Evidence View | Bundle Size | Scale | Bundle Strategy | Why |
| --- | --- | --- | ---: | ---: | --- | --- |
| `v3_1_c4_gpt_4_1_mini_scale_5` | `gpt-4.1-mini` | `l2_neutralized` | `1` | `5` | singleton | Scale-size extension for mini |
| `v3_1_c4_gpt_5_2_chat_scale_5` | `gpt-5.2-chat` | `l2_neutralized` | `1` | `5` | singleton | Scale-size extension for chat |
| `v3_1_c5_gpt_4_1_mini_bundle_5_cluster_l2` | `gpt-4.1-mini` | `l2_neutralized` | `5` | `4` | `semantic_cluster_5` | Bundle/clustering extension for mini |
| `v3_1_c5_gpt_5_2_chat_bundle_5_cluster_l2` | `gpt-5.2-chat` | `l2_neutralized` | `5` | `4` | `semantic_cluster_5` | Bundle/clustering extension for chat |

### Family C6/C7: High-Scale Clustered Probes

Purpose:
- test whether clustered bundle regimes actually use a richer ordinal space,
- check whether higher-cardinality scales create meaningful stage differentiation rather than dead bins,
- probe whether `gpt-5.2` remains thresholded while `gpt-4.1` uses added resolution.

All of these should use:

- `concept = fascism`
- `abstain_enabled = true`
- `scoring_method = subset`
- `evidence_bundle_size = 5`
- `evidence_view = l2_neutralized`
- `bundle_strategy = semantic_cluster_5`

#### New experiments

| Tag | Model | Scale | Why |
| --- | --- | ---: | --- |
| `v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7` | `gpt-4.1` | `7` | First high-scale probe in clustered regime |
| `v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7` | `gpt-5.2` | `7` | Same as above for `gpt-5.2` |
| `v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` | `gpt-4.1` | `9` | Maximal high-scale probe |
| `v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` | `gpt-5.2` | `9` | Same as above for `gpt-5.2` |

## Why This Matrix

This plan keeps V3.1 focused on the real unresolved questions.

### What it answers

#### 1. Are `a6/a7` real?

Comparisons:

- existing `a6/a7` versus `c2/c3`
- `c1` random bundling versus `c2` semantic clustering

If the geometry survives corrected cluster matching, the result is real. If it collapses under random bundling or changes sharply under corrected grouping, the original `a6/a7` result was partly structural.

#### 2. Does `l3` matter under standardized clustering?

Comparison:

- `c2` semantic-cluster `l2`
- `c3` same clustering logic projected to `l3`

This is the clean `l2 -> l3` test that V3 did not provide.

#### 3. Are small/chat models just weaker copies?

Comparisons:

- `c4` versus the mainline scale-5 runs
- `c5` versus the mainline semantic-cluster bundle runs

This gives a proper symmetry check instead of a one-family anecdote.

#### 4. Does higher scale only matter once evidence is bundled?

Comparisons:

- `c2` clustered scale-4 versus `c6` clustered scale-7
- `c2` clustered scale-4 versus `c7` clustered scale-9

This is the best direct test of the hypothesis that larger scales only become interesting in clustered multi-evidence regimes.

## Primary Endpoints

V3.1 should keep the same core behavioral panel:

- abstain rate
- singleton rate
- mean subset size
- mean expected stage
- mid-scale mass
- stage entropy

Secondary endpoints:

- TBM conflict
- closed-world conflict
- expert-agreement certainty
- rubric embedding similarity

## Planned Analysis Additions

V3.1 should also include the certainty analysis that was clarified after V3 freeze:

- certainty by verdict geometry, not just by family average
- certainty for:
  - `abstain`
  - singleton verdicts like `[1]`, `[2]`, `[3]`
  - adjacent subsets like `[2,3]`, `[3,4]`
  - broader subsets like `[2,3,4]`

This should answer whether expressive subsets are treated as low-confidence hedges or high-confidence ambiguity.

## Expected Output Structure

V3.1 should be written up separately from V3:

- V3 frozen results: [v3_gpt_ablations.md](/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md)
- V3.1 finale iteration: `docs/pilots/v3_1_gpt_ablations.md`

The final V3.1 report should focus on:

1. clustering repair,
2. small-model symmetry,
3. scale/geometry certainty,
4. whether `l3` survives corrected matching.

## Recommended Order

1. implement clustering metadata and export changes
2. create the 14 V3.1 experiments
3. run the corrected clustering family first
4. run the small-model extensions
5. run the clustered high-scale probes
6. analyze with the existing V3 investigation pipeline plus:
   - verdict-geometry certainty tables
   - updated matched clustering comparisons

## Summary

V3.1 should not be another broad sweep. It should be a narrow cleanup and confirmation pass.

The concrete recommendation is:

- keep V3 as the frozen baseline,
- add **14 new experiments**,
- center V3.1 on clustering repair and small-model symmetry,
- include the clustered high-scale probes,
- and treat that as the final iteration for this pilot line.
