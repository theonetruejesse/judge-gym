# V4 Native OpenAI Scale

- Experiments: `20`
- Providers: `4`
- Samples per experiment: `30`
- Evidence set: `v4_native_concepts_shared_v1_set`

## Provider Summary

| model | experiment_count | mean_expected_stage | mean_abstain_rate | mean_singleton_rate |
| --- | --- | --- | --- | --- |
| gpt-4.1 | 5 | 1.604 | 0.029 | 0.760 |
| gpt-4.1-mini | 5 | 1.757 | 0.027 | 0.890 |
| gpt-5.2 | 5 | 1.305 | 0.080 | 0.919 |
| gpt-5.2-chat | 5 | 1.416 | 0.096 | 0.898 |

## Lane Summary

| concept | condition_key | experiment_count | mean_expected_stage | mean_abstain_rate | mean_singleton_rate |
| --- | --- | --- | --- | --- | --- |
| fascism | abstention_source | 4 | 1.674 | 0.290 | 0.760 |
| fascism | baseline_source | 4 | 1.516 | 0.000 | 0.853 |
| fascism | view_l2_neutralized | 4 | 1.493 | 0.000 | 0.888 |
| illiberal democracy | baseline_source | 4 | 1.489 | 0.000 | 0.909 |
| illiberal democracy | view_l2_neutralized | 4 | 1.430 | 0.000 | 0.924 |

## Strongest Contrasts

- `fascism_abstention_source:gpt41mini_vs_gpt41` flip `0.735`; abstain delta `-0.011`; expected-stage delta `0.055`
- `gpt52chat:fascism:baseline_vs_abstention` flip `0.731`; abstain delta `0.481`; expected-stage delta `0.053`
- `gpt41:fascism:baseline_vs_abstention` flip `0.729`; abstain delta `0.145`; expected-stage delta `-0.000`
- `gpt41mini:fascism:baseline_vs_abstention` flip `0.703`; abstain delta `0.134`; expected-stage delta `-0.011`
- `fascism_abstention_source:gpt52_vs_gpt41` flip `0.696`; abstain delta `0.255`; expected-stage delta `-0.284`
- `fascism_abstention_source:gpt52chat_vs_gpt41` flip `0.694`; abstain delta `0.335`; expected-stage delta `-0.012`
- `gpt52:fascism:baseline_vs_abstention` flip `0.640`; abstain delta `0.400`; expected-stage delta `0.092`
- `fascism_view_l2_neutralized:gpt41mini_vs_gpt41` flip `0.610`; abstain delta `0.000`; expected-stage delta `0.147`
- `gpt41mini:baseline:fascism_vs_illiberal_democracy` flip `0.604`; abstain delta `0.000`; expected-stage delta `0.193`
- `illiberal_democracy_baseline_source:gpt41mini_vs_gpt41` flip `0.601`; abstain delta `0.000`; expected-stage delta `0.295`
- `gpt41:fascism:source_vs_l2` flip `0.599`; abstain delta `0.000`; expected-stage delta `-0.083`
- `fascism_baseline_source:gpt41mini_vs_gpt41` flip `0.586`; abstain delta `0.000`; expected-stage delta `0.073`

## Experiment Metrics

| experiment_tag | model | concept | condition_key | mean_expected_stage | abstain_rate | singleton_rate | mean_subset_size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v4_native_fascism_abstention_source_gpt41 | gpt-4.1 | fascism | abstention_source | 1.712 | 0.145 | 0.614 | 1.423 |
| v4_native_fascism_abstention_source_gpt41mini | gpt-4.1-mini | fascism | abstention_source | 1.761 | 0.134 | 0.781 | 1.226 |
| v4_native_fascism_abstention_source_gpt52 | gpt-5.2 | fascism | abstention_source | 1.452 | 0.400 | 0.870 | 1.130 |
| v4_native_fascism_abstention_source_gpt52chat | gpt-5.2-chat | fascism | abstention_source | 1.772 | 0.481 | 0.775 | 1.238 |
| v4_native_fascism_baseline_source_gpt41 | gpt-4.1 | fascism | baseline_source | 1.630 | 0.000 | 0.758 | 1.285 |
| v4_native_fascism_baseline_source_gpt41mini | gpt-4.1-mini | fascism | baseline_source | 1.703 | 0.000 | 0.901 | 1.103 |
| v4_native_fascism_baseline_source_gpt52 | gpt-5.2 | fascism | baseline_source | 1.285 | 0.000 | 0.878 | 1.124 |
| v4_native_fascism_baseline_source_gpt52chat | gpt-5.2-chat | fascism | baseline_source | 1.448 | 0.000 | 0.876 | 1.128 |
| v4_native_fascism_view_l2_neutralized_gpt41 | gpt-4.1 | fascism | view_l2_neutralized | 1.547 | 0.000 | 0.779 | 1.263 |
| v4_native_fascism_view_l2_neutralized_gpt41mini | gpt-4.1-mini | fascism | view_l2_neutralized | 1.694 | 0.000 | 0.924 | 1.078 |
| v4_native_fascism_view_l2_neutralized_gpt52 | gpt-5.2 | fascism | view_l2_neutralized | 1.331 | 0.000 | 0.935 | 1.066 |
| v4_native_fascism_view_l2_neutralized_gpt52chat | gpt-5.2-chat | fascism | view_l2_neutralized | 1.402 | 0.000 | 0.915 | 1.090 |
| v4_native_illiberal_democracy_baseline_source_gpt41 | gpt-4.1 | illiberal democracy | baseline_source | 1.601 | 0.000 | 0.828 | 1.229 |
| v4_native_illiberal_democracy_baseline_source_gpt41mini | gpt-4.1-mini | illiberal democracy | baseline_source | 1.896 | 0.000 | 0.912 | 1.093 |
| v4_native_illiberal_democracy_baseline_source_gpt52 | gpt-5.2 | illiberal democracy | baseline_source | 1.207 | 0.000 | 0.942 | 1.060 |
| v4_native_illiberal_democracy_baseline_source_gpt52chat | gpt-5.2-chat | illiberal democracy | baseline_source | 1.251 | 0.000 | 0.951 | 1.058 |
| v4_native_illiberal_democracy_view_l2_neutralized_gpt41 | gpt-4.1 | illiberal democracy | view_l2_neutralized | 1.532 | 0.000 | 0.822 | 1.230 |
| v4_native_illiberal_democracy_view_l2_neutralized_gpt41mini | gpt-4.1-mini | illiberal democracy | view_l2_neutralized | 1.733 | 0.000 | 0.934 | 1.067 |
| v4_native_illiberal_democracy_view_l2_neutralized_gpt52 | gpt-5.2 | illiberal democracy | view_l2_neutralized | 1.250 | 0.000 | 0.969 | 1.031 |
| v4_native_illiberal_democracy_view_l2_neutralized_gpt52chat | gpt-5.2-chat | illiberal democracy | view_l2_neutralized | 1.206 | 0.000 | 0.971 | 1.030 |
