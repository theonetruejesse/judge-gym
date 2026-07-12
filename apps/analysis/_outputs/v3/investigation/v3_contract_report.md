# V3 Public Contract Report

This is a portable publication snapshot of the frozen V3 analysis contract. It replaces local generator paths and reports only artifacts tracked in the public revision.

## Inputs

- Contract: [`_blueprints/v3-analysis-process/analysis_contract.json`](../../../../../_blueprints/v3-analysis-process/analysis_contract.json)
- Figure manifest: [`_blueprints/v3-analysis-process/figures_manifest.json`](../../../../../_blueprints/v3-analysis-process/figures_manifest.json)
- Contrast registry: [`apps/analysis/contracts/v3_contrasts.json`](../../../contracts/v3_contrasts.json)
- Public investigation root: `apps/analysis/_outputs/v3/investigation`

## Frozen contract snapshot

- Contract version: `1`
- Schema: `3`
- Retained snapshots: `32`
- Excluded legacy bundle cells: `4`
- Registered contrasts: `28`
- Signature-matched contrasts: `28`

The historical contrast registry includes `a5_concept_swap`, but its two registered cells both use illiberal democracy and differ by model. That name is retained for compatibility and must not be interpreted as an isolated concept intervention.

## Public table inventory

| Table | Public status | Rows |
| --- | --- | ---: |
| `matching_validation.csv` | tracked | 28 |
| `family_effects.csv` | tracked | 308 |
| `family_effects_qvalues.csv` | tracked | 168 |
| `bundle_policy_deltas.csv` | tracked | 108 |
| `scale_certainty_effects.csv` | tracked | 32 |
| `sample_instability.csv` | tracked | 30 |
| `experiment_geometry.csv` | tracked | 32 |
| `aggregation_sensitivity_report_panel.csv` | tracked | 5 |

Links:

- [matching validation](tables/matching_validation.csv)
- [family effects](tables/family_effects.csv)
- [FDR-adjusted effects](tables/family_effects_qvalues.csv)
- [bundle-policy deltas](tables/bundle_policy_deltas.csv)
- [scale/certainty effects](tables/scale_certainty_effects.csv)
- [sample instability](tables/sample_instability.csv)
- [experiment geometry](tables/experiment_geometry.csv)
- [aggregation sensitivity](tables/aggregation_sensitivity_report_panel.csv)

## Public figure inventory

| Figure | Role |
| --- | --- |
| [abstention verdict distribution](figures/family_verdict_heatmaps/a1_abstain_toggle_verdict_distribution.png) | report-grade same-model result |
| [bundle-strategy hero](figures/curated/hero_bundle_strategy_heatmap.png) | report-grade methodological result |
| [scale-probe hero](figures/curated/hero_scale_probe_profile.png) | report-grade scale result |
| [scale/certainty profile](figures/scale_certainty_effects.png) | report-grade scale/certainty result |
| [joint role-assignment heatmap](figures/family_effect_heatmaps/a4_model_swap_heatmap.png) | report-grade with joint-attribution caveat |
| [`a5` historical heatmap](figures/family_effect_heatmaps/a5_concept_swap_heatmap.png) | diagnostic only; confounded |

## Publication boundary

The local generation run produced 76 figures and 32 tables. The public repository intentionally tracks a smaller curated evidence bundle: 8 V3 PNGs and 8 V3 CSV tables, plus reports and summary metadata. Untracked exploratory and embedding artifacts are not asserted as available in a fresh clone.

## Interpretation gates

- Technical completion does not imply scientific validity.
- `a1` supports a same-model abstention effect.
- `a4` supports a joint role-assignment effect, not isolated attribution to rubric generation or scoring.
- `a5` does not identify concept framing.
- Conflict metrics are diagnostic rather than headline endpoints.
- Matching is validated through exported signatures, not guaranteed identity of all internal sampling objects.
