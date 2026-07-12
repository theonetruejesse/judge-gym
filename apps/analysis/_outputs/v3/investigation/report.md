# V3 Investigation Report

This is the first execution-pass investigation over the cached V3 pilot data. It validates contrast matching, materializes derived tables, and computes matched family effects so later reporting can be driven by tables instead of manual chart browsing.

## Scope

- Experiments analyzed: 32
- Families covered: 14
- Primary unit for inference in this pass: matched `sample_ordinal`

## Matching Validation

Fully matched contrasts in this pass:
- `a1_abstain_toggle:v3_a1_gpt_4_1_abstain_false__vs__v3_a1_gpt_4_1_abstain_true`: 30 matched samples
- `a1_abstain_toggle:v3_a1_gpt_5_2_abstain_false__vs__v3_a1_gpt_5_2_abstain_true`: 30 matched samples
- `a2_evidence_level_l3:v3_a2_gpt_4_1_l3__vs__v3_a2_gpt_5_2_l3`: 30 matched samples
- `a3_scale_size:v3_a3_gpt_4_1_scale_5__vs__v3_a3_gpt_5_2_scale_5`: 30 matched samples
- `a4_model_swap:v3_a4_rubric_gpt_4_1_scoring_gpt_5_2__vs__v3_a4_rubric_gpt_5_2_scoring_gpt_4_1`: 30 matched samples
- `a5_concept_swap:v3_a5_gpt_4_1_illiberal_democracy__vs__v3_a5_gpt_5_2_illiberal_democracy`: 30 matched samples
- `b1_small_model_family:v3_b1_gpt_4_1_mini_abstain_false__vs__v3_b1_gpt_4_1_mini_abstain_true`: 30 matched samples
- `b1_small_model_family:v3_b1_gpt_5_2_chat_abstain_false__vs__v3_b1_gpt_5_2_chat_abstain_true`: 30 matched samples
- `c1_bundle_5_random_l2:v3_1_c1_gpt_4_1_bundle_5_random_l2__vs__v3_1_c1_gpt_5_2_bundle_5_random_l2`: 30 matched samples
- `c1_bundle_strategy:v3_1_c1_gpt_4_1_bundle_5_random_l2__vs__v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2`: 30 matched samples
- `c1_bundle_strategy:v3_1_c1_gpt_5_2_bundle_5_random_l2__vs__v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2`: 30 matched samples
- `c2_bundle_5_cluster_l2_v2:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2`: 30 matched samples
- `c2_l3_projection:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2`: 30 matched samples
- `c2_l3_projection:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2`: 30 matched samples
- `c3_bundle_5_cluster_l3_v2:v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2__vs__v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2`: 30 matched samples
- `c4_small_model_scale:v3_b1_gpt_4_1_mini_abstain_true__vs__v3_1_c4_gpt_4_1_mini_scale_5`: 30 matched samples
- `c4_small_model_scale:v3_b1_gpt_5_2_chat_abstain_true__vs__v3_1_c4_gpt_5_2_chat_scale_5`: 30 matched samples
- `c4_small_model_scale_5:v3_1_c4_gpt_4_1_mini_scale_5__vs__v3_1_c4_gpt_5_2_chat_scale_5`: 30 matched samples
- `c5_small_model_bundle_5_cluster_l2:v3_1_c5_gpt_4_1_mini_bundle_5_cluster_l2__vs__v3_1_c5_gpt_5_2_chat_bundle_5_cluster_l2`: 30 matched samples
- `c6_bundle_5_cluster_l2_scale_7:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7`: 30 matched samples
- `c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7`: 30 matched samples
- `c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7`: 30 matched samples
- `c7_bundle_5_cluster_l2_scale_9:v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9`: 30 matched samples
- `c7_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9`: 30 matched samples
- `c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9`: 30 matched samples
- `c7_scale_probe_step:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9`: 30 matched samples
- `c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9`: 30 matched samples
- `d1_control:v3_d1_control_gpt_4_1__vs__v3_d1_control_gpt_5_2`: 30 matched samples

Reference tables:
- [matching_validation.csv](tables/matching_validation.csv)
- [matching_details.csv](tables/matching_details.csv)

## First-Pass Findings

- Abstention is a real behavioral lever, not a cosmetic flag: `a1_abstain_toggle:v3_a1_gpt_5_2_abstain_false__vs__v3_a1_gpt_5_2_abstain_true` shifts abstain rate by `0.438` (95% CI `0.377` to `0.497`).
- In `a4`, swapping rubric/scoring model roles moves abstention more than stage severity: `a4_model_swap:v3_a4_rubric_gpt_4_1_scoring_gpt_5_2__vs__v3_a4_rubric_gpt_5_2_scoring_gpt_4_1` changes abstain rate by `-0.263` (95% CI `-0.345` to `-0.175`).
- `a5` is one of the strongest semantic interventions: `a5_concept_swap:v3_a5_gpt_4_1_illiberal_democracy__vs__v3_a5_gpt_5_2_illiberal_democracy` changes mean subset size by `-0.439` (95% CI `-0.520` to `-0.356`).
- In the corrected bundle follow-up, grouping policy itself is a real lever: `c1_bundle_strategy:v3_1_c1_gpt_5_2_bundle_5_random_l2__vs__v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2` changes TBM conflict by `0.435` (95% CI `0.299` to `0.576`).
- In the clustered high-scale probe, `c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7` changes mean subset size by `0.511` (95% CI `0.308` to `0.728`).
- `v3_d1_control_gpt_4_1` is an interpretability anchor rather than a normal comparator: abstain rate is `0.800`, singleton rate is `0.958`, and closed-world conflict is `0.000`.
- `v3_d1_control_gpt_5_2` is an interpretability anchor rather than a normal comparator: abstain rate is `0.892`, singleton rate is `1.000`, and closed-world conflict is `0.000`.

## Ranked Signals

- `experiment_outlier`: v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 is high on mean_subset_size (2.381, z=3.29)
- `experiment_outlier`: v3_d1_control_gpt_5_2 is high on abstain_rate (0.892, z=3.14)
- `compression_outlier`: v3_d1_control_gpt_5_2 is low on stage_entropy (0.174, z=-3.06)
- `experiment_outlier`: v3_d1_control_gpt_4_1 is high on abstain_rate (0.800, z=2.72)
- `family_effect`: c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 shifts mean_expected_stage by 2.713 (95% CI 2.530 to 2.911, n=30)
- `compression_outlier`: v3_d1_control_gpt_5_2 is low on mid_scale_mass (0.000, z=-2.63)
- `compression_outlier`: v3_d1_control_gpt_4_1 is low on mid_scale_mass (0.021, z=-2.54)
- `experiment_outlier`: v3_1_c1_gpt_5_2_bundle_5_random_l2 is low on mean_tbm_conflict (0.041, z=-2.42)

## Strongest Matched Family Effects

- `c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` on `mean_expected_stage`: mean delta `2.713` (95% bootstrap CI `2.530` to `2.911`, `n=30`)
- `c7_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` on `mean_expected_stage`: mean delta `2.147` (95% bootstrap CI `1.909` to `2.381`, `n=30`)
- `c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7` on `mean_expected_stage`: mean delta `1.596` (95% bootstrap CI `1.457` to `1.739`, `n=30`)
- `c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7` on `mean_expected_stage`: mean delta `1.326` (95% bootstrap CI `1.143` to `1.501`, `n=30`)
- `c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` on `mean_expected_stage`: mean delta `1.118` (95% bootstrap CI `0.906` to `1.314`, `n=30`)
- `c7_scale_probe_step:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` on `mean_expected_stage`: mean delta `0.821` (95% bootstrap CI `0.623` to `1.019`, `n=30`)

## Sample Instability

- `S03` instability `2.139` (abstain std `0.318`, subset std `0.535`, expected-stage std `0.989`)
- `S13` instability `2.012` (abstain std `0.290`, subset std `0.561`, expected-stage std `0.851`)
- `S22` instability `1.967` (abstain std `0.291`, subset std `0.509`, expected-stage std `0.879`)
- `S04` instability `1.945` (abstain std `0.282`, subset std `0.434`, expected-stage std `0.933`)
- `S19` instability `1.928` (abstain std `0.271`, subset std `0.544`, expected-stage std `0.793`)

## Adjudicative Geometry

- Low mid-scale occupancy: `v3_d1_control_gpt_5_2` mid-scale mass `0.000`, stage entropy `0.174`.
- Low mid-scale occupancy: `v3_d1_control_gpt_4_1` mid-scale mass `0.021`, stage entropy `0.280`.
- Low mid-scale occupancy: `v3_b1_gpt_4_1_mini_abstain_true` mid-scale mass `0.374`, stage entropy `0.659`.
- Low stage entropy: `v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7` stage entropy `0.467`, abstain mass `0.042`.

## Rubric Similarity

- Focused model-family rubric clustering:
  - highest cosine `v3_1_c1_gpt_4_1_bundle_5_random_l2` vs `v3_a4_rubric_gpt_4_1_scoring_gpt_5_2` = `0.999`.
  - highest cosine `v3_a4_rubric_gpt_4_1_scoring_gpt_5_2` vs `v3_1_c1_gpt_4_1_bundle_5_random_l2` = `0.999`.
  - highest cosine `v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2` vs `v3_a1_gpt_5_2_abstain_false` = `0.999`.
  - lowest cosine `v3_b1_gpt_4_1_mini_abstain_true` vs `v3_a5_gpt_5_2_illiberal_democracy` = `0.835`.
  - lowest cosine `v3_a5_gpt_5_2_illiberal_democracy` vs `v3_b1_gpt_4_1_mini_abstain_true` = `0.835`.
  - lowest cosine `v3_1_c4_gpt_4_1_mini_scale_5` vs `v3_a5_gpt_5_2_illiberal_democracy` = `0.841`.
- Full-rubric similarity: `c4_small_model_scale_5:v3_1_c4_gpt_4_1_mini_scale_5__vs__v3_1_c4_gpt_5_2_chat_scale_5` mean cosine `0.924`.
- Full-rubric similarity: `c5_small_model_bundle_5_cluster_l2:v3_1_c5_gpt_4_1_mini_bundle_5_cluster_l2__vs__v3_1_c5_gpt_5_2_chat_bundle_5_cluster_l2` mean cosine `0.924`.
- Full-rubric similarity: `a3_scale_size:v3_a3_gpt_4_1_scale_5__vs__v3_a3_gpt_5_2_scale_5` mean cosine `0.927`.
- Full-rubric similarity: `c2_bundle_5_cluster_l2_v2:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2` mean cosine `0.927`.
- Full-rubric similarity: `c3_bundle_5_cluster_l3_v2:v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2__vs__v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2` mean cosine `0.929`.
- Stage-level similarity: `c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` stage `5` mean cosine `0.763`.
- Stage-level similarity: `c7_bundle_5_cluster_l2_scale_9:v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` stage `7` mean cosine `0.767`.
- Stage-level similarity: `c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7` stage `4` mean cosine `0.773`.
- Stage-level similarity: `c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` stage `4` mean cosine `0.774`.
- Stage-level similarity: `c7_bundle_5_cluster_l2_scale_9:v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` stage `8` mean cosine `0.776`.

## Scale Size vs Certainty

- Fully matched scale-size contrasts: `c4_small_model_scale:v3_b1_gpt_4_1_mini_abstain_true__vs__v3_1_c4_gpt_4_1_mini_scale_5`, `c4_small_model_scale:v3_b1_gpt_5_2_chat_abstain_true__vs__v3_1_c4_gpt_5_2_chat_scale_5`, `c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7`, `c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7`, `c7_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9`, `c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9`, `c7_scale_probe_step:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9`, `c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9`.
- `c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9` changes expert-agreement certainty by `0.030` (95% CI `-0.001` to `0.058`, `n=30`).
- `c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7` changes expert-agreement certainty by `0.029` (95% CI `-0.000` to `0.058`, `n=30`).
- `c4_small_model_scale:v3_b1_gpt_5_2_chat_abstain_true__vs__v3_1_c4_gpt_5_2_chat_scale_5` changes expert-agreement certainty by `-0.025` (95% CI `-0.060` to `0.008`, `n=30`).
- `c4_small_model_scale:v3_b1_gpt_4_1_mini_abstain_true__vs__v3_1_c4_gpt_4_1_mini_scale_5` changes expert-agreement certainty by `0.010` (95% CI `-0.008` to `0.026`, `n=30`).
- Response-level OLS on matched scale-size experiments estimates a `scale_size` coefficient of `0.002` on expert-agreement certainty (95% CI `-0.004` to `0.007`, `p=0.527`, `R^2=0.288`).

## Experiment Similarity

- `v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` vs `v3_d1_control_gpt_5_2` distance `7.227`
- `v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7` vs `v3_d1_control_gpt_5_2` distance `6.956`
- `v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` vs `v3_d1_control_gpt_4_1` distance `6.860`
- `v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7` vs `v3_d1_control_gpt_4_1` distance `6.612`
- `v3_a1_gpt_5_2_abstain_false` vs `v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9` distance `6.568`

Reference tables:
- [experiment_metrics.csv](tables/experiment_metrics.csv)
- [experiment_geometry.csv](tables/experiment_geometry.csv)
- [sample_metrics.csv](tables/sample_metrics.csv)
- [evidence_metrics.csv](tables/evidence_metrics.csv)
- [family_pair_deltas.csv](tables/family_pair_deltas.csv)
- [family_effects.csv](tables/family_effects.csv)
- [rubric_embeddings.csv](tables/rubric_embeddings.csv)
- [rubric_stage_embeddings.csv](tables/rubric_stage_embeddings.csv)
- [rubric_criterion_embeddings.csv](tables/rubric_criterion_embeddings.csv)
- [rubric_experiment_similarity.csv](tables/rubric_experiment_similarity.csv)
- [rubric_experiment_clusters.csv](tables/rubric_experiment_clusters.csv)
- [rubric_focus_similarity.csv](tables/rubric_focus_similarity.csv)
- [rubric_focus_clusters.csv](tables/rubric_focus_clusters.csv)
- [rubric_contrast_similarity.csv](tables/rubric_contrast_similarity.csv)
- [rubric_stage_contrast_similarity.csv](tables/rubric_stage_contrast_similarity.csv)
- [scale_matching_validation.csv](tables/scale_matching_validation.csv)
- [scale_certainty_effects.csv](tables/scale_certainty_effects.csv)
- [scale_certainty_regression.csv](tables/scale_certainty_regression.csv)
- [sample_instability.csv](tables/sample_instability.csv)
- [experiment_distances.csv](tables/experiment_distances.csv)
- [bundle_verdict_profiles.csv](tables/bundle_verdict_profiles.csv)
- [bundle_belief_tbm.csv](tables/bundle_belief_tbm.csv)
- [bundle_belief_closed_world.csv](tables/bundle_belief_closed_world.csv)
- [candidate_findings.csv](tables/candidate_findings.csv)
- [mine_v3_ranked_findings.csv](tables/mine_v3_ranked_findings.csv)
- [mine_v3_summary.md](tables/mine_v3_summary.md)
- [aggregation_sensitivity_sample_methods.csv](tables/aggregation_sensitivity_sample_methods.csv)
- [aggregation_sensitivity_method_summary.csv](tables/aggregation_sensitivity_method_summary.csv)
- [aggregation_sensitivity_method_alignment.csv](tables/aggregation_sensitivity_method_alignment.csv)
- [aggregation_sensitivity_contrast_sensitivity.csv](tables/aggregation_sensitivity_contrast_sensitivity.csv)
- [aggregation_sensitivity_report_panel.csv](tables/aggregation_sensitivity_report_panel.csv)

## Figures

- [family_effect_heatmap.png](figures/family_effect_heatmap.png)
- [experiment_adjudicative_heatmap.png](figures/experiment_adjudicative_heatmap.png)
- [family_effect_abstain_rate.png](figures/family_effect_abstain_rate.png)
- [family_effect_mean_subset_size.png](figures/family_effect_mean_subset_size.png)
- [curated/hero_contrast_heatmap.png](figures/curated/hero_contrast_heatmap.png)
- [curated/hero_scale_probe_profile.png](figures/curated/hero_scale_probe_profile.png)
- [curated/hero_bundle_strategy_heatmap.png](figures/curated/hero_bundle_strategy_heatmap.png)
- [rubric_similarity_heatmap.png](figures/rubric_similarity_heatmap.png)
- [rubric_similarity_dendrogram.png](figures/rubric_similarity_dendrogram.png)
- [rubric_focus_heatmap.png](figures/rubric_focus_heatmap.png)
- [rubric_focus_dendrogram.png](figures/rubric_focus_dendrogram.png)
- [rubric_stage_similarity_heatmap.png](figures/rubric_stage_similarity_heatmap.png)
- [sample_instability.png](figures/sample_instability.png)
- [sample_expected_stage_heatmap.png](figures/sample_expected_stage_heatmap.png)
- [sample_abstain_heatmap.png](figures/sample_abstain_heatmap.png)
- [scale_certainty_effects.png](figures/scale_certainty_effects.png)
- [family_verdict_heatmaps/](figures/family_verdict_heatmaps)
- [family_belief_heatmaps/](figures/family_belief_heatmaps)

## Caveats

- Matching is validated only through exported sample/bundle/window signatures in this pass; it is not yet guaranteed that every family corresponds to identical internal sampling objects.
- The invalid original `a6/a7` bundle families are excluded from interpretation; the corrected V3.1 bundle families are now part of the matched statistical pass.
- Belief/conflict metrics are included as diagnostics, not headline endpoints.
