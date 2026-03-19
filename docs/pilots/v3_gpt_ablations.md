# V3 - GPT Ablations

## Experimental Procedure

1. I treated the final V3 result as one combined pilot line: the original V3 matrix plus the corrected follow-up runs that repaired the invalid early bundle comparisons.
2. The final analyzed slice contains `32` completed experiments with `30` matched samples each.
3. The primary unit of comparison is the matched `sample_ordinal`, not pooled raw response averages.
4. The analysis uses the frozen contract in [\_blueprints/v3-analysis-process/analysis_contract.json](/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-analysis-process/analysis_contract.json) and the regenerated output bundle in [investigation](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation).
5. Four original legacy bundle experiments were explicitly excluded from scientific interpretation because their grouping policy was not comparable across models:
   - `v3_a6_gpt_4_1_bundle_5_l2`
   - `v3_a6_gpt_5_2_bundle_5_l2`
   - `v3_a7_gpt_4_1_bundle_5_l3`
   - `v3_a7_gpt_5_2_bundle_5_l3`

## Methodology

### Design Goal

The purpose of V3 was to move beyond the V2 discovery result and ask a sharper question: which parts of the judge configuration materially change adjudicative geometry when the concept and evidence surface are held as constant as possible.

The relevant experimental axes were:

- abstention policy
- evidence representation level
- scale size
- rubric/scoring model placement
- concept framing
- smaller/chat model family variants
- evidence grouping and bundle policy

The experiment surface was therefore not a bakeoff between models in the abstract. It was a matched ablation study over configured judge regimes.

### Units and Comparison Surface

The primary unit of analysis is the matched `sample_ordinal`. This matters because pooled response averages hide regime shifts that are visible at matched sample grain.

The analysis stack uses:

- abstain rate
- singleton rate
- mean subset size
- expected stage
- mid-scale occupancy
- stage entropy
- expert-agreement confidence
- matched family deltas with multiplicity control
- local semantic rubric embeddings
- aggregation sensitivity panels

The current methodological hierarchy is:

1. geometry-first summaries as primary
2. weighted linear pooling as stable global baseline
3. DST / TBM / closed-world belief summaries as diagnostic lenses

### Corrected Bundle Surface

The original V3 bundle families were not cleanly comparable across models, so they were excluded from scientific interpretation. The corrected `c1` through `c7` follow-up families provide the clean bundle-policy, clustered-scale, and small/chat follow-up surface that now belongs in the main V3 story.

## Experimental Matrix

| Family                            | Experiments                                                                                                                                  | Purpose                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `a1` abstention toggle            | `v3_a1_gpt_4_1_abstain_false`, `v3_a1_gpt_4_1_abstain_true`, `v3_a1_gpt_5_2_abstain_false`, `v3_a1_gpt_5_2_abstain_true`                     | test whether abstention changes judge regime     |
| `a2` `l3` evidence view           | `v3_a2_gpt_4_1_l3`, `v3_a2_gpt_5_2_l3`                                                                                                       | test abstracted evidence representation          |
| `a3` 5-point scale                | `v3_a3_gpt_4_1_scale_5`, `v3_a3_gpt_5_2_scale_5`                                                                                             | test larger ordinal scale                        |
| `a4` rubric/scoring role swap     | `v3_a4_rubric_gpt_4_1_scoring_gpt_5_2`, `v3_a4_rubric_gpt_5_2_scoring_gpt_4_1`                                                               | test model placement in the pipeline             |
| `a5` concept framing              | `v3_a5_gpt_4_1_illiberal_democracy`, `v3_a5_gpt_5_2_illiberal_democracy`                                                                     | test semantic concept swap                       |
| `b1` small/chat family            | `v3_b1_gpt_4_1_mini_abstain_false`, `v3_b1_gpt_4_1_mini_abstain_true`, `v3_b1_gpt_5_2_chat_abstain_false`, `v3_b1_gpt_5_2_chat_abstain_true` | test smaller/chat variants under the same regime |
| `d1` control                      | `v3_d1_control_gpt_4_1`, `v3_d1_control_gpt_5_2`                                                                                             | anchor condition                                 |
| `c1` corrected bundle random `l2` | `v3_1_c1_gpt_4_1_bundle_5_random_l2`, `v3_1_c1_gpt_5_2_bundle_5_random_l2`                                                                   | clean random bundle baseline                     |
| `c2` corrected clustered `l2`     | `v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2`, `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2`                                                           | clean clustered bundle comparison                |
| `c3` corrected clustered `l3`     | `v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2`, `v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2`                                                           | clustered `l2 -> l3` follow-up                   |
| `c4` small/chat scale-5           | `v3_1_c4_gpt_4_1_mini_scale_5`, `v3_1_c4_gpt_5_2_chat_scale_5`                                                                               | symmetric small/chat scale follow-up             |
| `c5` small/chat clustered bundle  | `v3_1_c5_gpt_4_1_mini_bundle_5_cluster_l2`, `v3_1_c5_gpt_5_2_chat_bundle_5_cluster_l2`                                                       | small/chat bundle follow-up                      |
| `c6` clustered scale-7            | `v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7`, `v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7`                                                 | higher-scale clustered probe                     |
| `c7` clustered scale-9            | `v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9`, `v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9`                                                 | high-cardinality clustered probe                 |

## Results

### Finding 1: Abstention is a real behavioral lever

The abstention toggle is the cleanest replicated intervention in the full pilot line.

| Family | Model          | Abstain Rate Delta | Expected Stage Delta |
| ------ | -------------- | -----------------: | -------------------: |
| `a1`   | `gpt-5.2`      |           `+0.438` |             `+0.426` |
| `a1`   | `gpt-4.1`      |           `+0.202` |    smaller / noisier |
| `b1`   | `gpt-5.2-chat` |           `+0.373` |             `+0.476` |
| `b1`   | `gpt-4.1-mini` |           `+0.390` |             `+0.164` |

Abstention changes the operating regime, not just the formatting of the answer.

### Finding 2: Concept framing is one of the strongest movers

The `fascism -> illiberal democracy` swap is one of the largest matched shifts in the matrix.

| Metric           |    Delta |
| ---------------- | -------: |
| Mean subset size | `-0.439` |
| Expected stage   | `-0.384` |
| Abstain rate     | `+0.332` |

This is a real semantic framing effect, not a small prompt perturbation.

### Finding 3: Model placement matters

The rubric/scoring role swap changes the regime materially.

| Metric                                  |    Delta |
| --------------------------------------- | -------: |
| Abstain rate                            | `-0.263` |
| Mean score expert-agreement probability | `+0.176` |

So model identity is not the only issue; model placement inside the pipeline matters too.

### Finding 4: Adjudicative compression is real, but not universal

The `d1` control condition produces a genuinely compressed regime:

| Experiment              | Abstain Mass | Mid-Scale Mass | Stage Entropy | Singleton Rate |
| ----------------------- | -----------: | -------------: | ------------: | -------------: |
| `v3_d1_control_gpt_5_2` |      `0.892` |        `0.000` |       `0.174` |        `1.000` |
| `v3_d1_control_gpt_4_1` |      `0.800` |        `0.021` |       `0.280` |        `0.958` |

But the corrected clustered follow-ups show a different regime:

| Experiment                                    | Abstain Mass | Mid-Scale Mass |        Stage Entropy | Mean Subset Size |
| --------------------------------------------- | -----------: | -------------: | -------------------: | ---------------: |
| `v3_1_c1_gpt_5_2_bundle_5_random_l2`          |      `0.000` |        `0.926` |              `0.484` |          `1.317` |
| `v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2`      |      `0.117` |        `0.753` |              `0.630` |          `1.302` |
| `v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7` |      `0.008` |           high | low / interior-heavy |          `2.109` |
| `v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` |      `0.017` |           high | low / interior-heavy |          `2.381` |

So V3 gives at least two distinct non-smooth regimes:

- abstain-heavy compression
- interior concentration / broad-subset expression

### Finding 5: Clustering strategy is part of the instrument

The corrected bundle follow-up shows that grouping policy itself changes behavior.

For bundle-5 `gpt-5.2`, random `l2 -> semantic cluster l2` changes:

| Metric                | Random L2 | Clustered L2 |    Delta |
| --------------------- | --------: | -----------: | -------: |
| Abstain rate          |   `0.000` |      `0.117` | `+0.117` |
| Mean subset size      |   `1.317` |      `1.302` |    small |
| TBM conflict          |   `0.041` |      `0.476` | `+0.435` |
| Closed-world conflict |   `0.099` |      `0.241` | `+0.142` |

For `gpt-4.1`, clustering also changes the regime:

| Metric           | Random L2 | Clustered L2 |    Delta |
| ---------------- | --------: | -----------: | -------: |
| Abstain rate     |   `0.050` |      `0.075` | `+0.025` |
| Singleton rate   |   `0.351` |      `0.523` | `+0.172` |
| Mean subset size |   `1.781` |      `1.586` | `-0.195` |
| TBM conflict     |   `0.530` |      `0.717` | `+0.187` |

This is a methodological result as much as a model result: bundle construction is part of the measurement instrument.

### Finding 6: `l3` remains weaker than expected

Even after correcting the bundle comparison surface, `l3` is not a first-order lever on the level of `a1`, `a4`, or `a5`.

| Comparison                     | Abstain Delta | Subset Size Delta | TBM Conflict Delta |
| ------------------------------ | ------------: | ----------------: | -----------------: |
| `gpt-4.1` clustered `l2 -> l3` |      `+0.017` |          `+0.084` |           `-0.195` |
| `gpt-5.2` clustered `l2 -> l3` |      `+0.025` |          `+0.019` |           ~`0.000` |

The current read is that `l3` is a modest reframing, not a dominant intervention in this matrix.

### Finding 7: Scale size changes expression more than certainty

The clean original V3 scale comparison is 4-point versus 5-point:

| Model     | Abstain Delta | Expected Stage Delta | Mean Subset Size Delta | Expert-Agreement Delta |
| --------- | ------------: | -------------------: | ---------------------: | ---------------------: |
| `gpt-4.1` |      `-0.097` |             `+0.390` |               `+0.016` |               `-0.006` |
| `gpt-5.2` |      `-0.193` |             `+0.555` |               `+0.165` |               `-0.020` |

The clustered high-scale probes extend that story:

| Comparison                   | Mean Subset Size Delta | Certainty Delta | Read                                        |
| ---------------------------- | ---------------------: | --------------: | ------------------------------------------- |
| `gpt-4.1` clustered `7 -> 9` |               `+0.272` |        ~`0.001` | richer expression, stable certainty         |
| `gpt-5.2` clustered `7 -> 9` |               `+0.022` |        ~`0.001` | little expressive gain, large conflict jump |

So scale size mostly expands expression rather than confidence.

### Finding 8: Small/chat models are not just weaker copies

The follow-up panel shows the smaller/chat variants are distinct regimes, not simple degraded copies.

| Comparison                                 | Abstain Delta | Singleton Delta | Subset Size Delta | TBM Conflict Delta |
| ------------------------------------------ | ------------: | --------------: | ----------------: | -----------------: |
| `gpt-4.1-mini` scale-5 -> clustered bundle |      `+0.102` |        `-0.275` |          `+0.277` |           `-0.373` |
| `gpt-5.2-chat` scale-5 -> clustered bundle |      `-0.145` |        `-0.414` |          `+0.464` |           `-0.859` |

The `gpt-5.2-chat` clustered bundle condition is one of the stronger wins in the whole follow-up.

### Finding 9: Rubric semantics move less than scoring behavior

The local semantic embedding pass shows:

- high full-rubric similarity across matched contrasts
- larger differences at the stage level, especially upper stages
- no evidence that most interventions are wholesale rubric rewrites

So many of the behavioral shifts in V3 are happening in scoring behavior and evidence interaction, not just in radically different rubric semantics.

### Finding 10: Geometry-first summaries are more stable than global belief aggregation

The aggregation sensitivity panel now makes the hierarchy clear:

| Method                 | Mean Expected Stage | Entropy | Top-1 Probability | Mean Conflict |
| ---------------------- | ------------------: | ------: | ----------------: | ------------: |
| Geometry-first         |             `2.822` | `0.525` |           `0.609` |             - |
| Weighted linear pool   |             `2.784` | `0.515` |           `0.616` |             - |
| Log opinion pool       |             `2.817` | `0.073` |           `0.940` |             - |
| Local TBM              |             `2.744` | `0.271` |           `0.830` |       `0.655` |
| Local closed-world DST |             `2.839` | `0.098` |           `0.931` |       `0.576` |

The practical implication is:

- geometry-first summaries are the main analytical language
- weighted linear pooling is the most stable global aggregation baseline
- TBM / closed-world DST remain useful diagnostics, especially for bundle-policy sensitivity, but they should not be the main headline summary

## Discussion

The main lesson from V3 is that the configured judge regime matters more than any isolated scalar summary. The pilot now supports a more precise interpretation than the earlier exploratory passes.

First, abstention, concept framing, and model placement are the strongest clean interventions in the matrix. These are not small presentation tweaks. They materially alter how the judge occupies the verdict space.

Second, the corrected bundle families changed the methodological story. The project can no longer treat evidence grouping as a neutral preprocessing choice. Bundle policy shapes the measurement surface itself. That is why the corrected `c1` through `c7` panel belongs in the main scientific story rather than being treated as a side operational note.

Third, the project now has a better internal taxonomy of non-smooth behavior. Compression is real, but it is not the only regime worth naming. Interior concentration, thresholded gating, and smoother graded use are behaviorally distinct and should be treated as separate analytical objects.

Fourth, the current evidence narrows the role of aggregation. Geometry-first summaries are carrying the main story. Weighted linear pooling is the most stable global baseline. DST-style summaries are still useful, but mainly when the question is about ambiguity structure, bundle-policy sensitivity, or conflict rather than overall experiment ranking.

## Relevant Figures and Tables

### Canonical Figures

These are the figures a collaborator should look at first:

1. [hero_contrast_heatmap.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/curated/hero_contrast_heatmap.png)
2. [hero_bundle_strategy_heatmap.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/curated/hero_bundle_strategy_heatmap.png)
3. [hero_scale_probe_profile.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/curated/hero_scale_probe_profile.png)
4. [a1_abstain_toggle_verdict_distribution.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/a1_abstain_toggle_verdict_distribution.png)
5. [a5_concept_swap_heatmap.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/a5_concept_swap_heatmap.png)
6. [c1_bundle_strategy_heatmap.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/c1_bundle_strategy_heatmap.png)
7. [c2_bundle_5_cluster_l2_v2_tbm_belief.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_belief_heatmaps/c2_bundle_5_cluster_l2_v2_tbm_belief.png)
8. [c7_bundle_5_cluster_l2_scale_9_verdict_distribution_geometry_bucketed.png](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/c7_bundle_5_cluster_l2_scale_9_verdict_distribution_geometry_bucketed.png)

### Canonical Tables

These are the main tables backing the report:

- [family_effects.csv](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/family_effects.csv)
- [family_effects_qvalues.csv](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/family_effects_qvalues.csv)
- [experiment_geometry.csv](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/experiment_geometry.csv)
- [mine_v3_summary.md](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/mine_v3_summary.md)
- [aggregation_sensitivity_report_panel.csv](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/aggregation_sensitivity_report_panel.csv)
- [sample_instability.csv](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/sample_instability.csv)

### Main Output Bundle

- [report.md](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/report.md)
- [summary.json](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/summary.json)
- [v3_contract_report.md](/Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/v3_contract_report.md)

## Limitations

- This is still a pilot-scale result, even though the combined matrix is much cleaner than the earlier exploratory passes.
- The strongest claims are about geometry and matched intervention effects, not about human validity or external truth.
- Conflict metrics remain diagnostic rather than headline endpoints.
- The certainty layer still needs a direct verdict-geometry treatment: abstain, singleton stage, adjacent subset, non-adjacent subset, and broad subset.
- The rubric embedding layer is now real, but motif-level rubric analysis and concept-space structure are still future work.

## Future Work and V4 Recommendations

### Provider and model-family expansion

- Expand beyond the current OpenAI-heavy panel into a balanced provider family comparison.
- Include at least one Anthropic family, one Google family, and one open-weight family in the same corrected matrix.
- Run the same abstention, scale, clustering, and concept ablations symmetrically rather than via isolated spot checks.

### Window and bundle-process standardization

- Promote bundle plans into first-class measurement objects instead of implicit runtime behavior.
- Standardize cluster generation, bundle signatures, source window ids, and `l2 -> l3` projection rules.
- Keep deterministic random baselines, semantic-cluster baselines, and projected `l3` bundle plans as reusable objects attached to the same evidence universe.
- Tighten the window construction process so that evidence grouping, bundle count, and source coverage have explicit invariants rather than ad hoc defaults.

### Concept-space exploration

- Expand beyond one or two manually chosen concepts into a small concept family:
  - fascism
  - illiberal democracy
  - democratic erosion
  - authoritarian populism
  - state repression
- Treat concept engineering as a first-class design problem rather than just prompt wording.
- A Kevin Scharp style interpretation is especially relevant here: when a concept is politically loaded and operationally unstable, the task is not only to measure the inherited concept more cleanly, but to engineer sharper successor concepts and test whether adjudicative geometry becomes more stable under those revisions.

### Statistical refinements

- Pre-register a small primary endpoint panel and keep the rest secondary.
- Make FDR control standard for every family-level result table.
- Add verdict-geometry certainty tables directly into the canonical output.
- Add a stronger case-study layer for the most unstable samples instead of relying only on aggregate tables.
- Extend the aggregation sensitivity panel into a formal robustness appendix.

### Framework formalization

- Treat geometry-first summaries as the primary framework, not an auxiliary convenience metric.
- Treat global aggregation methods as a sensitivity layer with clearly defined roles:
  - weighted linear pooling as baseline
  - log pooling as sharper alternative
  - local TBM / local closed-world as diagnostic ambiguity lenses
- Formalize the distinction between:
  - compression
  - interior concentration
  - thresholded gating
  - smooth graded use
- Promote the analysis contract, contrast registry, and figure manifest into stable interfaces rather than one-off pilot machinery.

## Summary

The final V3 read is:

1. `a1`, `a4`, and `a5` are the strongest clean hits.
2. Clustering strategy is part of the instrument, not a minor implementation detail.
3. `l3` remains weaker than expected in the current matrix.
4. Scale size changes expressivity more than certainty.
5. Compression is real, but only for some configurations.
6. `gpt-4.1` handles clustered high-scale probing more cleanly than `gpt-5.2`.
7. `gpt-5.2-chat` clustered bundling is one of the strongest follow-up wins.
8. Geometry-first analysis is now the right backbone for the project.
