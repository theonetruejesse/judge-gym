# V3 final results

## Scope

V3 is a pilot-scale matched ablation study of configured LLM-judge regimes, not a model leaderboard or a validation against human truth. The retained analysis covers **32 experiments × 30 matched samples** (960 experiment–sample cells), with **28/28 registered contrasts fully matched** on `sample_ordinal`. Four legacy bundle cells were excluded because their grouping policies were not comparable; corrected bundle runs replace them for interpretation. See the [contract report](../../apps/analysis/_outputs/v3/investigation/v3_contract_report.md), [matching table](../../apps/analysis/_outputs/v3/investigation/tables/matching_validation.csv), and [contrast overview](../../apps/analysis/_outputs/v3/investigation/figures/curated/hero_contrast_heatmap.png).

We use four evidence labels below:

- **Matched same-model effect** — the strongest causal evidence available here: the model and matched sample are held fixed while a configuration changes.
- **Matched configuration effect** — matched samples, but multiple pipeline roles or identities change together; attribution is joint.
- **Descriptive anchor** — an observed regime profile, useful for interpretation but not an intervention estimate.
- **Diagnostic** — a secondary or model-dependent summary (especially belief conflict), not a headline endpoint.

## Results

### 1. Abstention is the clearest same-model lever

**Matched same-model effect.** Enabling abstention increased abstain rate by **+0.438** for GPT-5.2 (95% bootstrap CI **+0.377 to +0.497**) and **+0.202** for GPT-4.1 (**+0.148 to +0.258**), each over 30 matched samples. For GPT-5.2 it also increased expected stage by **+0.426** (**+0.319 to +0.542**); GPT-4.1's expected-stage change was weaker (**+0.200**, **−0.034 to +0.413**). The intervention therefore changes verdict geometry, not merely output formatting. [Effect table](../../apps/analysis/_outputs/v3/investigation/tables/family_effects.csv) · [verdict distributions](../../apps/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/a1_abstain_toggle_verdict_distribution.png)

### 2. Compression is a descriptive anchor, not a universal law

**Descriptive anchor.** The control configurations are strongly abstain-heavy and compressed: GPT-5.2 has abstain mass **0.892**, singleton rate **1.000**, mid-scale mass **0.000**, and stage entropy **0.174**; GPT-4.1 has **0.800**, **0.958**, **0.021**, and **0.280**, respectively. Corrected bundle and high-scale conditions instead show interior concentration and broader subsets—for example, clustered scale-9 GPT-4.1 has mid-scale mass **0.942** and mean subset size **2.381**. “Compression” is therefore a useful regime label, not a claim that all judge configurations collapse in the same way. [Geometry table](../../apps/analysis/_outputs/v3/investigation/tables/experiment_geometry.csv) · [scale profile](../../apps/analysis/_outputs/v3/investigation/figures/curated/hero_scale_probe_profile.png)

### 3. Scale changes expression more clearly than certainty

**Matched same-model effect.** In clustered GPT-4.1 runs, moving from a 4-point to a 7-point scale increased mean subset size by **+0.511** (**+0.317 to +0.717**) and moving from 4 to 9 points increased it by **+0.794** (**+0.511 to +1.070**). The corresponding expert-agreement changes were only **+0.005** (**−0.023 to +0.032**) and **+0.006** (**−0.015 to +0.029**). Across matched scale experiments, response-level OLS estimated a scale-size coefficient of **0.002** on expert-agreement certainty (95% CI **−0.004 to +0.007**, p = **0.527**). Larger scales clearly relocate and sometimes broaden verdict expression; V3 does not show a reliable increase in reported certainty. Expected-stage shifts should be read partly as a change in available coordinate range, not as direct evidence of greater confidence. [Scale/certainty table](../../apps/analysis/_outputs/v3/investigation/tables/scale_certainty_effects.csv) · [scale/certainty figure](../../apps/analysis/_outputs/v3/investigation/figures/scale_certainty_effects.png)

### 4. Bundle strategy is part of the measurement instrument

**Matched same-model effect, with diagnostic support.** For GPT-5.2, changing bundle-5 evidence from random L2 grouping to semantic-clustered L2 increased abstain rate by **+0.117** (**+0.075 to +0.167**) while leaving mean subset size essentially unchanged (**−0.011**, **−0.158 to +0.131**). For GPT-4.1, clustering increased singleton rate by **+0.158** (**+0.014 to +0.305**). The GPT-5.2 TBM-conflict increase of **+0.435** (**+0.299 to +0.576**) is strong but remains **diagnostic**, because conflict depends on the aggregation formalism. Grouping policy is thus not neutral preprocessing; it changes the observed judge regime. [Bundle deltas](../../apps/analysis/_outputs/v3/investigation/tables/bundle_policy_deltas.csv) · [bundle strategy heatmap](../../apps/analysis/_outputs/v3/investigation/figures/curated/hero_bundle_strategy_heatmap.png)

### 5. Role placement matters, but the attribution is joint

**Matched configuration effect.** Swapping GPT-4.1 and GPT-5.2 between rubric-generation and scoring roles changed abstain rate by **−0.263** (**−0.345 to −0.175**) and expert-agreement probability by **+0.176** (**+0.152 to +0.200**). This establishes that the two role assignments produce different regimes. It does **not** isolate a pure “scorer effect” or “rubric-model effect”: both placements change together, and the generated rubric can mediate the result. [Effect table](../../apps/analysis/_outputs/v3/investigation/tables/family_effects.csv) · [role-swap heatmap](../../apps/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/a4_model_swap_heatmap.png)

### 6. L3 is weak in the corrected same-model comparison

**Matched same-model effect.** Under fixed clustered bundle plans, L2→L3 changed abstain rate by only **+0.017** for GPT-4.1 (95% CI **−0.092 to +0.133**) and **+0.025** for GPT-5.2 (**−0.042 to +0.092**). Mean subset-size changes were similarly small: **+0.057** (**−0.172 to +0.287**; 29 usable pairs) and **+0.022** (**−0.106 to +0.150**). V3 therefore supports, at most, a modest L3 reframing—not a first-order intervention. [Bundle deltas](../../apps/analysis/_outputs/v3/investigation/tables/bundle_policy_deltas.csv) · [L3 projection heatmap](../../apps/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/c2_l3_projection_heatmap.png)

## Required correction: the A5 “concept-framing effect” is confounded

**Confounded comparison; no concept-effect claim is supported.** The registered A5 contrast compares `v3_a5_gpt_4_1_illiberal_democracy` with `v3_a5_gpt_5_2_illiberal_democracy`. Both cells use the **same concept** while model identity changes, and there is no same-model fascism baseline in that contrast. Its reported shifts—including mean subset size **−0.439**, expected stage **−0.384**, and abstain rate **+0.332**—cannot be attributed to `fascism → illiberal democracy`. They are model-identity differences within the illiberal-democracy condition. Any earlier description of A5 as a clean or causal concept-framing result should be withdrawn pending a symmetric same-model concept ablation. The existing [A5 heatmap](../../apps/analysis/_outputs/v3/investigation/figures/family_effect_heatmaps/a5_concept_swap_heatmap.png) is retained only as a visualization of this confounded contrast, not evidence of a concept effect.

## Bottom line

The public-safe V3 result is narrow but useful: abstention is the strongest replicated same-model intervention; scale cardinality changes verdict expression much more clearly than certainty; evidence grouping is part of the instrument; role assignments matter but are not separately identified; and corrected L3 effects are weak. Compression remains a valuable descriptive anchor, not a universal property. These claims concern judge-output geometry under this pilot matrix—not external validity, factual correctness, or agreement with human experts. Full outputs are in the [investigation report](../../apps/analysis/_outputs/v3/investigation/report.md) and [summary](../../apps/analysis/_outputs/v3/investigation/summary.json).
