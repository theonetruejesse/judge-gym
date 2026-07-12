# V3 Public Investigation Report

This is the curated public report for Judge-Gym V3. It is derived from the frozen V3 analysis outputs but deliberately links only to artifacts tracked in the public repository.

## Scope

- 32 retained experiment cells
- 14 families
- 30 matched samples per cell
- 28 registered contrasts; 28/28 matched through exported signatures
- Four legacy bundle cells excluded because their grouping policies were not comparable

The primary inferential unit is matched `sample_ordinal`. Matching was checked through exported signatures; this does not prove identity of every internal sampling object.

## Claim types

- **Same-model intervention:** the same model is compared under a changed configuration.
- **Joint configuration contrast:** multiple linked roles change together.
- **Descriptive anchor:** a regime is summarized without causal attribution.
- **Diagnostic:** useful for investigation but not promoted as a headline endpoint.

## Results

### Abstention is the clearest same-model lever

For GPT-5.2, enabling abstention changed abstain rate by `+0.438` across 30 matched samples (95% CI `0.377–0.497`). The smaller/chat follow-ups point in the same direction. This supports a regime-change claim, not merely a formatting claim.

### `a5` does not identify concept framing

The registered family name remains `a5_concept_swap` for historical compatibility, but both cells use illiberal democracy and differ by model:

- `v3_a5_gpt_4_1_illiberal_democracy`
- `v3_a5_gpt_5_2_illiberal_democracy`

Its mean-subset-size delta of `-0.439` is therefore a descriptive cross-model comparison inside one concept condition. It is not evidence for a fascism-to-illiberal-democracy framing effect.

### `a4` is a joint role-assignment contrast

`a4` swaps both rubric generator and scorer. Abstain rate changes by `-0.263` (95% CI `-0.345–-0.175`), but the design does not isolate one role from the other, and the generated rubric may mediate the effect. The defensible claim is that configured role assignment matters.

### Compression exists, but is not universal

The controls are descriptive compression anchors:

- GPT-5.2 control: abstain `0.892`, mid-scale mass `0.000`, stage entropy `0.174`.
- GPT-4.1 control: abstain `0.800`, mid-scale mass `0.021`, stage entropy `0.280`.

Other clustered/high-scale conditions show low abstention and broader interior use, so unusual behavior should not be collapsed into one failure mode.

### Evidence grouping is part of the instrument

For GPT-5.2, random-L2 to clustered-L2 grouping changed TBM conflict by `+0.435` (95% CI `0.299–0.576`). Conflict is diagnostic, but the result demonstrates that bundle construction changes the observed measurement surface.

### Larger scales change expression more clearly than certainty

The response-level certainty regression estimated a scale-size coefficient of `0.002` (95% CI `-0.004–0.007`, `p=0.527`). Larger scales changed occupancy and subset expression without a corresponding clear increase in reported certainty.

### Corrected L2-to-L3 effects were modest

In same-model clustered comparisons, the GPT-4.1 subset-size delta was `+0.057`; GPT-5.2 was `+0.022`. The current V3 evidence does not support treating L3 abstraction as a first-order lever.

## Tracked public evidence

Tables:

- [matching validation](tables/matching_validation.csv)
- [family effects](tables/family_effects.csv)
- [FDR-adjusted family effects](tables/family_effects_qvalues.csv)
- [bundle-policy effects](tables/bundle_policy_deltas.csv)
- [scale/certainty effects](tables/scale_certainty_effects.csv)
- [experiment geometry](tables/experiment_geometry.csv)
- [sample instability](tables/sample_instability.csv)
- [aggregation sensitivity](tables/aggregation_sensitivity_report_panel.csv)

Figures:

- [abstention verdict distribution](figures/family_verdict_heatmaps/a1_abstain_toggle_verdict_distribution.png)
- [bundle-strategy hero](figures/curated/hero_bundle_strategy_heatmap.png)
- [scale-probe hero](figures/curated/hero_scale_probe_profile.png)
- [scale/certainty profile](figures/scale_certainty_effects.png)
- [joint role-assignment heatmap](figures/family_effect_heatmaps/a4_model_swap_heatmap.png)
- [`a5` historical contrast heatmap](figures/family_effect_heatmaps/a5_concept_swap_heatmap.png) — inspect only with the confounding warning above

## Limitations

- OpenAI-heavy, pilot-scale design.
- No human-validity or external-ground-truth claim.
- Matching verified through exported signatures rather than guaranteed identity of internal sampling objects.
- A4 is joint rather than role-isolated.
- A5 is confounded and cannot support a concept-framing claim.
- Conflict measures are diagnostic.
- The public bundle is curated rather than a complete copy of all locally generated exploratory artifacts.

For the publication-oriented synthesis, see [V3 final results](../../../../../docs/pilots/v3_final_results.md).
