# V3 - GPT Ablations

This document freezes the current V3 pilot before the planned V3.1 follow-up. The analysis artifacts referenced here were generated from the cached completed pilot under `packages/analysis/_outputs/v3/investigation/`.

## Experimental Setup

V3 is no longer a pooled model-comparison pilot. It is a matched intervention matrix over 22 completed experiments, with 30 samples per experiment, designed to test which judge-configuration choices actually move adjudicative behavior.

Main intervention families:

- `a1`: abstention toggle
- `a2`: `l3_abstracted` evidence view
- `a3`: 5-point scale
- `a4`: rubric/scoring model-role swap
- `a5`: concept swap to `illiberal democracy`
- `a6`: bundle-5 `l2`
- `a7`: bundle-5 `l3`
- `b1`: smaller/chat model panel
- `d1`: control condition

The primary matched inference unit in this pilot is `sample_ordinal`. All family-effect claims below are based on matched sample deltas unless noted otherwise.

## Key Findings

### 1. Abstention is a real behavioral lever

Abstention is not cosmetic. It materially changes geometry, especially for `gpt-5.2`.

- `a1`, `gpt-5.2`: abstain rate delta `+0.438` (95% CI `0.378` to `0.497`)
- `a1`, `gpt-5.2`: expected-stage delta `+0.426` (95% CI `0.317` to `0.543`)
- `a1`, `gpt-4.1`: weaker but still real

This is the cleanest replicated intervention effect in the matrix.

### 2. Concept framing is one of the strongest movers

`a5` is one of the strongest interventions in the entire sweep.

- mean subset size delta `-0.439` (95% CI `-0.526` to `-0.358`)
- expected-stage delta `-0.384` (95% CI `-0.519` to `-0.251`)

So concept framing is not a surface prompt detail. It changes the judge’s effective operating regime.

### 3. Model placement matters

`a4` shows that where the model sits in the pipeline matters, not just which model is present.

- abstain-rate delta `-0.263` (95% CI `-0.350` to `-0.175`)

The rubric-model/scoring-model split is therefore a meaningful design dimension, not an implementation detail.

### 4. Adjudicative compression is real, but not universal

`d1` is a genuine compressed regime:

| Experiment | Abstain Mass | Mid-Scale Mass | Stage Entropy | Singleton Rate |
| --- | ---: | ---: | ---: | ---: |
| `v3_d1_control_gpt_5_2` | `0.892` | `0.000` | `0.174` | `1.000` |
| `v3_d1_control_gpt_4_1` | `0.800` | `0.021` | `0.280` | `0.958` |

This is real adjudicative compression: very high abstention, near-zero interior-stage usage, and near-total singleton behavior.

But V3 also surfaced a different regime:

| Experiment | Abstain Mass | Mid-Scale Mass | Stage Entropy | Mean Subset Size |
| --- | ---: | ---: | ---: | ---: |
| `v3_a6_gpt_5_2_bundle_5_l2` | `0.042` | `0.887` | `0.483` | `1.270` |
| `v3_a7_gpt_5_2_bundle_5_l3` | `0.058` | `0.860` | `0.603` | `1.372` |
| `v3_a6_gpt_4_1_bundle_5_l2` | `0.025` | `0.817` | `0.769` | `1.735` |
| `v3_a7_gpt_4_1_bundle_5_l3` | `0.017` | `0.846` | `0.722` | `1.729` |

These are not compressed. They are interior-heavy, low-conflict, broader-subset regimes. So “unusual geometry” in V3 splits into at least two different phenomena:

- abstain-heavy compression
- interior concentration / broader subset use

### 5. `l3` is weaker than expected in this pilot

`l3` remains worth keeping for V3.1, but in the current pilot it does not look like a first-order lever on the level of `a1`, `a4`, or `a5`.

The weak read holds on two fronts:

- behavioral summaries do not show a large `l3` swing
- the rubric embedding pass does not show a dramatic semantic rewrite under `l3`

So the current evidence says `l3` is likely a modest reframing, not a dominant intervention, at least in this specific matrix.

### 6. Scale size changes expression more than certainty

The proper scale comparison in this pilot is `a1_abstain_true` (4-point) versus `a3_scale_5` (5-point), matched by model.

Matched scale effects:

| Model | Abstain Δ | Expected Stage Δ | Mean Subset Size Δ | Expert-Agreement Δ |
| --- | ---: | ---: | ---: | ---: |
| `gpt-4.1` | `-0.097` | `+0.390` | `+0.016` | `-0.006` |
| `gpt-5.2` | `-0.193` | `+0.555` | `+0.165` | `-0.020` |

Response-level OLS over the matched scale experiments estimates:

- `scale_size` coefficient on expert-agreement certainty: `-0.013`
- 95% CI: `-0.024` to `-0.002`
- `p = 0.0239`

So the 5-point scale does appear to expand expressive use of the rubric and reduce abstention, especially for `gpt-5.2`, but it does **not** materially improve certainty. The scale effect looks like an expressivity effect more than a calibration effect.

## Adjudicative Geometry

The scoring heatmaps for this pilot are here:

- [experiment_adjudicative_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/experiment_adjudicative_heatmap.png)
- [sample_expected_stage_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/sample_expected_stage_heatmap.png)
- [sample_abstain_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/sample_abstain_heatmap.png)

### Experiment-Level Geometry

![](../../packages/analysis/_outputs/v3/investigation/figures/experiment_adjudicative_heatmap.png)

### Sample-Level Expected Stage

![](../../packages/analysis/_outputs/v3/investigation/figures/sample_expected_stage_heatmap.png)

### Sample-Level Abstention

![](../../packages/analysis/_outputs/v3/investigation/figures/sample_abstain_heatmap.png)

These heatmaps are the clearest view of the current pilot. They show:

- `d1` as a true compressed regime
- `a6/a7` as interior-heavy and low-abstain
- `gpt-5.2` as more thresholded in several families, but not uniformly collapsed

## Proper Rubric Embedding Analysis

This pass replaces the earlier lexical TF-IDF proxy with local semantic embeddings using `BAAI/bge-small-en-v1.5`.

Embedding levels:

- full-rubric text
- stage-level text
- criterion-level text

Artifacts:

- [rubric_embeddings.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_embeddings.csv)
- [rubric_stage_embeddings.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_stage_embeddings.csv)
- [rubric_criterion_embeddings.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_criterion_embeddings.csv)
- [rubric_experiment_similarity.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_experiment_similarity.csv)
- [rubric_contrast_similarity.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_contrast_similarity.csv)
- [rubric_stage_contrast_similarity.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_stage_contrast_similarity.csv)
- [rubric_experiment_clusters.csv](../../packages/analysis/_outputs/v3/investigation/tables/rubric_experiment_clusters.csv)

### Full-Rubric Similarity

![](../../packages/analysis/_outputs/v3/investigation/figures/rubric_similarity_heatmap.png)

### Rubric Clustering

![](../../packages/analysis/_outputs/v3/investigation/figures/rubric_similarity_dendrogram.png)

### Stage-Level Similarity

![](../../packages/analysis/_outputs/v3/investigation/figures/rubric_stage_similarity_heatmap.png)

What the embedding pass says:

- full-rubric cosine similarity is high across all matched contrasts (`0.927` to `0.958`)
- the largest full-rubric divergence is the `a3` scale-size comparison, not `a5`
- the strongest divergences show up more clearly at the **stage level**, especially upper stages:
  - `a3`, stage 4: `0.817`
  - `a3`, stage 5: `0.835`
  - `d1`, stage 3: `0.845`
  - `a1` (`gpt-4.1`), stage 3: `0.850`

The most important methodological consequence is:

> Most V3 rubric differences are not wholesale semantic rewrites. They are localized stage-boundary shifts, especially in the more severe stages.

That matters because it suggests several of the behavioral differences in V3 are happening in scoring behavior and evidence interaction, not just in completely different rubric semantics.

The dendrogram also suggests that rubric space is still strongly structured by model family, with the two `illiberal democracy` runs separating as concept outliers.

## Sample-Level Instability

The most intervention-sensitive samples in this pilot are:

- `S06`
- `S30`
- `S03`
- `S25`
- `S13`

These are the best candidates for later case-study sections and for V3.1 follow-up diagnostics.

![](../../packages/analysis/_outputs/v3/investigation/figures/sample_instability.png)

## Limitations

- `a6/a7` still should be treated as descriptive rather than matched causal contrasts. The current analysis confirms bundle regrouping differences across models.
- Conflict metrics remain diagnostic rather than headline endpoints.
- The scale-size analysis is clean for the current pilot, but it is still limited to two matched model pairs.
- Proper rubric embeddings are now in place, but we still have not done the richer rubric-stage motif analysis or the planned rubric embedding case studies.
- This is still a pilot. It is strong enough for directional conclusions, not for grand theoretical claims.

## Interpretation

The current V3 read is:

1. **Real hits:** `a1`, `a4`, `a5`
2. **Real but descriptive-only for now:** `a6/a7`
3. **Weaker than expected:** `l3`
4. **Scale size mostly changes expressivity, not certainty**
5. **Compression is real, but only for some configurations**

That is enough to freeze this pilot and move to a narrow V3.1 cleanup pass focused on:

- bundle/clustering corrections
- symmetric follow-up GPT ablations
- deeper rubric embedding analysis
- alternative aggregation baselines for DST-sensitive families
