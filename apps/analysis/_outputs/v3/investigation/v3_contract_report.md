# V3 Contract Report

_Generated: 2026-03-19T22:04:13.404247+00:00_

## Inputs

- contract: `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-analysis-process/analysis_contract.json`
- figure manifest: `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-analysis-process/figures_manifest.json`
- investigation root: `apps/analysis/_outputs/v3/investigation`
- contrast registry: `apps/analysis/contracts/v3_contrasts.json`

## Contract Snapshot

- contract version `1`
- schema `3`
- snapshots `32`
- included tags `32`
- excluded tags `4`
- contrasts `28`
- inferential contrasts `28`
- descriptive contrasts `0`
- fully matched `28`

## Inferential Findings

| contrast_id | endpoint | mean_delta | ci_low | ci_high | sign_flip_pvalue |
| --- | --- | --- | --- | --- | --- |
| c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 | mean_expected_stage | 2.7134259259259257 | 2.5300231481481483 | 2.9106481481481477 | 0.0001999600079984003 |
| c7_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 | mean_expected_stage | 2.1468981481481477 | 1.9093900462962963 | 2.3810277777777773 | 0.0001999600079984003 |
| c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7 | mean_expected_stage | 1.5958333333333334 | 1.4569444444444444 | 1.7388888888888885 | 0.0001999600079984003 |
| c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7 | mean_expected_stage | 1.326388888888889 | 1.1429861111111113 | 1.5014930555555552 | 0.0001999600079984003 |
| c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 | mean_expected_stage | 1.1175925925925925 | 0.9064699074074074 | 1.3139004629629631 | 0.0001999600079984003 |
| c7_scale_probe_step:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 | mean_expected_stage | 0.8205092592592591 | 0.6227129629629629 | 1.0191377314814813 | 0.0001999600079984003 |
| c7_bundle_5_cluster_l2_scale_9:v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 | mean_subset_size | -0.8194444444444445 | -1.088888888888889 | -0.5611111111111111 | 0.0001999600079984003 |
| c7_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 | mean_subset_size | 0.7944444444444445 | 0.5332638888888889 | 1.064027777777777 | 0.0001999600079984003 |
| c6_bundle_5_cluster_l2_scale_7:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7 | mean_subset_size | -0.5555555555555556 | -0.7944444444444445 | -0.3304166666666674 | 0.0001999600079984003 |
| c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7 | mean_subset_size | 0.5111111111111112 | 0.30833333333333335 | 0.7277777777777779 | 0.0003999200159968006 |
| b1_small_model_family:v3_b1_gpt_5_2_chat_abstain_false__vs__v3_b1_gpt_5_2_chat_abstain_true | mean_expected_stage | 0.47586657759451884 | 0.3596908866596367 | 0.5928586988991402 | 0.0001999600079984003 |
| c1_bundle_5_random_l2:v3_1_c1_gpt_4_1_bundle_5_random_l2__vs__v3_1_c1_gpt_5_2_bundle_5_random_l2 | mean_subset_size | -0.46264367816091956 | -0.6408045977011495 | -0.2816091954022989 | 0.0001999600079984003 |

## Descriptive Findings

_No rows available._

## Spot Checks

Top unstable samples from `sample_instability.csv` using contract `topKUnstableSamples`.

| sample_ordinal | instability_score | experiment_count | abstain_rate_std | mean_subset_size_std |
| --- | --- | --- | --- | --- |
| 3 | 2.138812701761719 | 32 | 0.3179445072295154 | 0.5354603185532101 |
| 13 | 2.0115934339497965 | 32 | 0.290421690072412 | 0.5611354780881693 |
| 22 | 1.9674056733087575 | 32 | 0.29057350827230866 | 0.5093282818300688 |
| 4 | 1.944648255478112 | 32 | 0.2821959897179675 | 0.43379840679769727 |
| 19 | 1.9277237303742867 | 32 | 0.2714906209394065 | 0.5443313919127803 |
| 10 | 1.924430212161858 | 32 | 0.316164003990579 | 0.41400476927467184 |
| 6 | 1.9149443751624533 | 32 | 0.29153030606583374 | 0.42498848094289576 |
| 25 | 1.9036843006412472 | 32 | 0.21951192193356545 | 0.3905146102868268 |
| 30 | 1.8947342182283993 | 32 | 0.27903925033193167 | 0.3892356443628235 |
| 18 | 1.8890074578342329 | 32 | 0.3137916853171759 | 0.3813202322193716 |

## Mining Snapshot

| finding_scope | finding_type | rank_score | direction | summary |
| --- | --- | --- | --- | --- |
| descriptive | experiment_outlier | 3.2919657687260937 | positive | v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 is high on mean_subset_size (2.381, z=3.29) |
| descriptive | experiment_outlier | 3.135166345596078 | positive | v3_d1_control_gpt_5_2 is high on abstain_rate (0.892, z=3.14) |
| descriptive | compression_outlier | 3.056911646453605 | positive | v3_d1_control_gpt_5_2 is low on stage_entropy (0.174, z=-3.06) |
| descriptive | experiment_outlier | 2.7230757729113053 | positive | v3_d1_control_gpt_4_1 is high on abstain_rate (0.800, z=2.72) |
| descriptive | compression_outlier | 2.628461703323308 | positive | v3_d1_control_gpt_5_2 is low on mid_scale_mass (0.000, z=-2.63) |
| descriptive | compression_outlier | 2.5383333597439828 | positive | v3_d1_control_gpt_4_1 is low on mid_scale_mass (0.021, z=-2.54) |
| descriptive | experiment_outlier | 2.417728051496714 | positive | v3_1_c1_gpt_5_2_bundle_5_random_l2 is low on mean_tbm_conflict (0.041, z=-2.42) |
| descriptive | experiment_outlier | 2.403187398154138 | positive | v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7 is high on mean_subset_size (2.109, z=2.40) |
| descriptive | compression_outlier | 2.3949459362875967 | positive | v3_d1_control_gpt_4_1 is low on stage_entropy (0.280, z=-2.39) |
| descriptive | experiment_outlier | 2.2317267648680157 | positive | v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7 is low on singleton_rate (0.210, z=-2.23) |
| descriptive | experiment_outlier | 2.2233355847557825 | positive | v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 is low on singleton_rate (0.212, z=-2.22) |
| descriptive | sample_instability | 2.138812701761719 | positive | S03 is highly unstable across experiments (score=2.139, abstain_std=0.318, subset_std=0.535) |

## Aggregation Sensitivity

Scale/certainty effect rows:

| contrast_id | model_id | baseline_scale_size | variant_scale_size | endpoint | mean_delta | ci_low | ci_high |
| --- | --- | --- | --- | --- | --- | --- | --- |
| c4_small_model_scale:v3_b1_gpt_4_1_mini_abstain_true__vs__v3_1_c4_gpt_4_1_mini_scale_5 | gpt-4.1-mini | 4 | 5 | abstain_rate | -0.32500000000000007 | -0.39499999999999996 | -0.24833333333333338 |
| c4_small_model_scale:v3_b1_gpt_5_2_chat_abstain_true__vs__v3_1_c4_gpt_5_2_chat_scale_5 | gpt-5.2-chat | 4 | 5 | abstain_rate | -0.195 | -0.2617083333333333 | -0.12333333333333334 |
| c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7 | gpt-5.2 | 4 | 7 | abstain_rate | -0.075 | -0.125 | -0.025 |
| c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7 | gpt-4.1 | 4 | 7 | abstain_rate | -0.06666666666666667 | -0.14187499999999997 | 0.0 |
| c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 | gpt-5.2 | 4 | 9 | abstain_rate | -0.06666666666666667 | -0.13333333333333333 | 0.0 |
| c7_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 | gpt-4.1 | 4 | 9 | abstain_rate | -0.058333333333333334 | -0.14166666666666666 | 0.008333333333333333 |
| c7_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 | gpt-5.2 | 4 | 9 | mean_score_expert_agreement_prob | 0.02966666666666667 | -0.0009250000000000161 | 0.057754166666666676 |
| c6_scale_probe:v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7 | gpt-5.2 | 4 | 7 | mean_score_expert_agreement_prob | 0.02874999999999999 | -0.000337500000000011 | 0.057666666666666644 |
| c4_small_model_scale:v3_b1_gpt_5_2_chat_abstain_true__vs__v3_1_c4_gpt_5_2_chat_scale_5 | gpt-5.2-chat | 4 | 5 | mean_score_expert_agreement_prob | -0.025366666666666652 | -0.05985166666666666 | 0.007635833333333349 |
| c4_small_model_scale:v3_b1_gpt_4_1_mini_abstain_true__vs__v3_1_c4_gpt_4_1_mini_scale_5 | gpt-4.1-mini | 4 | 5 | mean_score_expert_agreement_prob | 0.00975 | -0.007749999999999957 | 0.02624999999999997 |
| c7_scale_probe_step:v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9 | gpt-4.1 | 7 | 9 | abstain_rate | 0.008333333333333333 | -0.016666666666666666 | 0.03333333333333333 |
| c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9 | gpt-5.2 | 7 | 9 | abstain_rate | 0.008333333333333333 | -0.041666666666666664 | 0.058333333333333334 |

Method summary rows:

| method | n_samples | mean_expected_stage | mean_entropy_norm | mean_top1_prob | mean_conflict |
| --- | --- | --- | --- | --- | --- |
| geometry_first | 960 | 2.8221749375131306 | 0.5249700031666881 | 0.6088910083522777 |  |
| weighted_linear_pool | 960 | 2.7835164553485696 | 0.5146865350965022 | 0.6164485477875806 |  |
| log_opinion_pool | 960 | 2.8166078596516413 | 0.0729540095810469 | 0.9396678739432377 |  |
| local_tbm | 960 | 2.7438616190525593 | 0.27093565513195 | 0.8302156803137449 | 0.6551212425579407 |
| local_closed_world | 960 | 2.8389084568365495 | 0.09798506362713845 | 0.9309514209661717 | 0.5757646131293263 |

Regression summary rows:

| term | coef | stderr | pvalue | conf_low | conf_high | r_squared | n_obs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Intercept | 0.9518800366300363 | 0.026924307778953434 | 3.560749696353036e-230 | 0.8990886578272685 | 1.004671415432804 | 0.2881705924249425 | 3120 |
| C(model_id)[T.gpt-4.1-mini] | 0.011324404761906135 | 0.012095661079939644 | 0.34922446398867213 | -0.012391957091605912 | 0.03504076661541818 | 0.2881705924249425 | 3120 |
| C(model_id)[T.gpt-5.2] | -0.21525000000000377 | 0.012878347762392871 | 4.2085049857672366e-60 | -0.24050100146157916 | -0.1899989985384284 | 0.2881705924249425 | 3120 |
| C(model_id)[T.gpt-5.2-chat] | -0.20366726190476403 | 0.012095661079939582 | 6.2182262388687224e-61 | -0.22738362375827595 | -0.1799509000512521 | 0.2881705924249425 | 3120 |
| C(sample_ordinal)[T.2] | -0.022500000000000388 | 0.023960436699838734 | 0.34777959452737695 | -0.06948001896597333 | 0.024480018965972565 | 0.2881705924249425 | 3120 |
| C(sample_ordinal)[T.3] | -0.0482692307692299 | 0.023960436699838286 | 0.04403958168951875 | -0.09524924973520198 | -0.0012892118032578198 | 0.2881705924249425 | 3120 |
| C(sample_ordinal)[T.4] | -0.026153846153845722 | 0.02396043669983852 | 0.27511924815080563 | -0.07313386511981826 | 0.020826172812126814 | 0.2881705924249425 | 3120 |
| C(sample_ordinal)[T.5] | 0.008076923076922524 | 0.023960436699838446 | 0.7360688497863539 | -0.03890309588904987 | 0.055056942042894914 | 0.2881705924249425 | 3120 |
| C(sample_ordinal)[T.6] | -0.014615384615384891 | 0.023960436699838404 | 0.5419200386587247 | -0.0615954035813572 | 0.032364634350587417 | 0.2881705924249425 | 3120 |
| C(sample_ordinal)[T.7] | 0.0012500000000003186 | 0.023960436699838845 | 0.9583971449350127 | -0.045730018965972855 | 0.048230018965973495 | 0.2881705924249425 | 3120 |

## Canonical Table Status

| table | status | path | rows | columns |
| --- | --- | --- | --- | --- |
| contrast_registry.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/contracts/v3_contrasts.json | n/a | n/a |
| matching_validation.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/matching_validation.csv | 28 | 12 |
| family_effects.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/family_effects.csv | 308 | 15 |
| family_effects_qvalues.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/family_effects_qvalues.csv | 168 | 18 |
| candidate_findings.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/candidate_findings.csv | 53 | 4 |
| mine_v3_ranked_findings.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/mine_v3_ranked_findings.csv | 50 | 10 |
| sample_instability.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/sample_instability.csv | 30 | 9 |
| verdict_geometry_certainty.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/verdict_geometry_certainty.csv | 345 | 11 |
| bundle_policy_deltas.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/bundle_policy_deltas.csv | 108 | 16 |
| robust_summary_panel.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/robust_summary_panel.csv | 32 | 15 |
| aggregation_sensitivity_report_panel.csv | present | /Users/jesselee/dev/research/jg/judge-gym/apps/analysis/_outputs/v3/investigation/tables/aggregation_sensitivity_report_panel.csv | 5 | 11 |

## Appendix Figure Inventory

### `hero`
- `hero_bundle_strategy_heatmap` -> `apps/analysis/_outputs/v3/investigation/figures/curated/hero_bundle_strategy_heatmap.png` (`report_grade`)
- `hero_contrast_heatmap` -> `apps/analysis/_outputs/v3/investigation/figures/curated/hero_contrast_heatmap.png` (`report_grade`)
- `hero_scale_probe_profile` -> `apps/analysis/_outputs/v3/investigation/figures/curated/hero_scale_probe_profile.png` (`report_grade`)
### `report`
- `a1_abstain_toggle_verdict_distribution` -> `apps/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/a1_abstain_toggle_verdict_distribution.png` (`report_grade`)
- `a5_concept_swap_heatmap` -> `apps/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/a5_concept_swap_heatmap.png` (`report_grade`)
- `c1_bundle_strategy_family_heatmap` -> `apps/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/c1_bundle_strategy_heatmap.png` (`report_grade`)
- `c2_clustered_tbm_belief` -> `apps/analysis/_outputs/v3/investigation/figures/family_belief_heatmaps/c2_bundle_5_cluster_l2_v2_tbm_belief.png` (`report_grade`)
- `scale_certainty_effects` -> `apps/analysis/_outputs/v3/investigation/figures/scale_certainty_effects.png` (`report_grade`)
### `appendix`
- `c7_scale_9_verdict_distribution` -> `apps/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/c7_bundle_5_cluster_l2_scale_9_verdict_distribution_geometry_bucketed.png` (`appendix_grade`) issues=raw unbucketed variant remains exploratory
- `experiment_adjudicative_heatmap` -> `apps/analysis/_outputs/v3/investigation/figures/experiment_adjudicative_heatmap.png` (`borderline`) issues=multi-facet label density; small text at reduced size
- `rubric_similarity_dendrogram` -> `apps/analysis/_outputs/v3/investigation/figures/rubric_similarity_dendrogram.png` (`appendix_grade`) issues=best used with a narrow claim rather than as a general summary
- `sample_expected_stage_heatmap` -> `apps/analysis/_outputs/v3/investigation/figures/sample_expected_stage_heatmap.png` (`appendix_grade`) issues=still requires multiple pages for the full experiment set
