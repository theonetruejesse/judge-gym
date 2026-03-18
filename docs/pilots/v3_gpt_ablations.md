# V3 - GPT Ablations

## Experimental Procedure

1. I ran a matched V3 intervention matrix over 22 completed experiments, with 30 samples per experiment, using the main `fascism` pool plus a small control pool.
2. The main V3 families tested:
   - abstention toggle (`a1`)
   - `l3_abstracted` evidence view (`a2`)
   - 5-point scale (`a3`)
   - rubric/scoring model-role swap (`a4`)
   - concept swap to `illiberal democracy` (`a5`)
   - bundle-5 `l2` and `l3` conditions (`a6`, `a7`)
   - smaller/chat model extensions (`b1`)
   - control condition (`d1`)
3. The primary unit of comparison was the matched `sample_ordinal`, not pooled raw response averages.
4. Analysis was generated from the cached completed pilot in `packages/analysis/_outputs/v3/investigation/`, including:
   - matched family deltas
   - adjudicative heatmaps
   - sample-instability summaries
   - rubric similarity and local semantic embedding analysis

## Key Findings

### Finding 1: Abstention is a real behavioral lever

The abstention toggle is not cosmetic. It changes adjudicative behavior materially, especially for `gpt-5.2`.

| Family | Model | Abstain Rate Delta | Expected Stage Delta | Interpretation |
| :----- | :---- | -----------------: | -------------------: | :------------- |
| `a1` | `gpt-5.2` | `+0.438` | `+0.426` | Strong operating-regime shift |
| `a1` | `gpt-4.1` | smaller but real | smaller but real | Same direction, weaker effect |

This is the cleanest replicated intervention effect in the full V3 matrix.

### Finding 2: Concept framing is one of the strongest movers

The concept swap from `fascism` to `illiberal democracy` (`a5`) produces one of the largest behavioral shifts in the pilot.

| Metric | Delta |
| :----- | ----: |
| Mean subset size | `-0.439` |
| Expected stage | `-0.384` |

Concept framing is therefore not a surface prompt detail. It changes the effective adjudicative regime.

### Finding 3: Model placement matters

The rubric/scoring role swap (`a4`) changes behavior materially.

| Metric | Delta |
| :----- | ----: |
| Abstain rate | `-0.263` |

This means where the model sits in the pipeline matters, not just which model is present.

### Finding 4: Adjudicative compression is real, but not universal

The control family (`d1`) shows a genuinely compressed regime:

| Experiment | Abstain Mass | Mid-Scale Mass | Stage Entropy | Singleton Rate |
| :--------- | -----------: | -------------: | ------------: | -------------: |
| `v3_d1_control_gpt_5_2` | `0.892` | `0.000` | `0.174` | `1.000` |
| `v3_d1_control_gpt_4_1` | `0.800` | `0.021` | `0.280` | `0.958` |

This is real adjudicative compression: very high abstention, near-zero interior-stage use, and near-total singleton behavior.

But the bundle families surfaced a different regime:

| Experiment | Abstain Mass | Mid-Scale Mass | Stage Entropy | Mean Subset Size |
| :--------- | -----------: | -------------: | ------------: | ---------------: |
| `v3_a6_gpt_5_2_bundle_5_l2` | `0.042` | `0.887` | `0.483` | `1.270` |
| `v3_a7_gpt_5_2_bundle_5_l3` | `0.058` | `0.860` | `0.603` | `1.372` |
| `v3_a6_gpt_4_1_bundle_5_l2` | `0.025` | `0.817` | `0.769` | `1.735` |
| `v3_a7_gpt_4_1_bundle_5_l3` | `0.017` | `0.846` | `0.722` | `1.729` |

These are not compressed. They are interior-heavy and broader-subset regimes. So “unusual geometry” in V3 splits into at least two different phenomena:

- abstain-heavy compression
- interior concentration / broader subset use

### Finding 5: `l3` is weaker than expected in this pilot

`l3` remains worth carrying into V3.1, but in the frozen V3 pilot it does not look like a first-order lever on the level of `a1`, `a4`, or `a5`.

This weak read holds on two fronts:

- behaviorally, `l3` does not produce a large matched shift
- semantically, the rubric embedding pass does not show a dramatic rewrite under `l3`

So the current evidence suggests `l3` is a modest reframing rather than a dominant intervention in this matrix.

### Finding 6: Scale size changes expression more than certainty

The clean scale comparison in V3 is `a1_abstain_true` (4-point) versus `a3_scale_5` (5-point), matched by model.

| Model | Abstain Delta | Expected Stage Delta | Mean Subset Size Delta | Expert-Agreement Delta |
| :---- | ------------: | -------------------: | ---------------------: | ---------------------: |
| `gpt-4.1` | `-0.097` | `+0.390` | `+0.016` | `-0.006` |
| `gpt-5.2` | `-0.193` | `+0.555` | `+0.165` | `-0.020` |

So the 5-point scale expands expressive use of the rubric and reduces abstention, especially for `gpt-5.2`, but it does not materially improve certainty. In this pilot, scale looks more like an expressivity lever than a calibration lever.

### Finding 7: Rubric semantics move less than scoring behavior

The proper local semantic embedding pass shows:

- high full-rubric similarity across matched contrasts (`0.927` to `0.958`)
- larger differences at the stage level, especially in upper stages
- no evidence that most V3 interventions are wholesale rubric rewrites

The practical consequence is:

> Many V3 behavioral shifts are happening in scoring behavior and evidence interaction, not just in radically different rubric semantics.

## Supporting Artifacts

### Adjudicative Geometry

- [experiment_adjudicative_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/experiment_adjudicative_heatmap.png)
- [sample_expected_stage_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/sample_expected_stage_heatmap.png)
- [sample_abstain_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/sample_abstain_heatmap.png)

### Rubric Similarity / Embeddings

- [rubric_similarity_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/rubric_similarity_heatmap.png)
- [rubric_similarity_dendrogram.png](../../packages/analysis/_outputs/v3/investigation/figures/rubric_similarity_dendrogram.png)
- [rubric_stage_similarity_heatmap.png](../../packages/analysis/_outputs/v3/investigation/figures/rubric_stage_similarity_heatmap.png)

### Sample Instability

The most intervention-sensitive samples in this pilot are:

- `S06`
- `S30`
- `S03`
- `S25`
- `S13`

These are the best candidates for later case studies and V3.1 diagnostics.

## Limitations

- `a6/a7` should still be treated as descriptive rather than clean matched causal contrasts. The current analysis confirms bundle-regrouping differences across models.
- Conflict metrics remain diagnostic rather than headline endpoints.
- The scale-size analysis is clean only for the current matched model pairs.
- The rubric embedding layer is now real, but motif-level rubric analysis and richer case studies are still future work.
- This is still a pilot. The findings are strong enough for directional conclusions, not for grand theoretical claims.

## Summary

The current V3 read is:

1. **Real hits:** `a1`, `a4`, `a5`
2. **Real but descriptive-only for now:** `a6/a7`
3. **Weaker than expected:** `l3`
4. **Scale size mostly changes expressivity, not certainty**
5. **Compression is real, but only for some configurations**

That is enough to freeze V3 and move to a narrow V3.1 cleanup pass focused on clustering repair, symmetric follow-up GPT ablations, and deeper rubric analysis.
