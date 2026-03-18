# Current V3 Signal Scan: Priority Families and Metrics

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/experiment_metrics.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/family_metrics.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/family_membership.csv
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v2_engine_prototype_testing.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/paper.md
- https://neurips.cc/virtual/2025/poster/121675
- https://aclanthology.org/2025.tacl-1.26/

**Summary:**
This scan identifies which V3 experiment families look most promising for the first report based on the current exported summary tables. The strongest early signals are: (1) evidence-bundling families (a6/a7) being extreme outliers on conflict and subset geometry, (2) the abstention gate (a1) producing large, model-dependent abstain-rate shifts with smaller but coherent shifts in specificity/subset breadth, (3) rubric-vs-scoring model swap (a4) providing an unusually clean decomposition of rubric quality vs scorer behavior, and (4) the control family (d1) exhibiting a qualitatively different regime (very high abstention and near-pure singleton outputs) that should anchor interpretation but also raises confounding concerns. Several metrics appear saturated (especially TBM conflict near 1.0 outside a6/a7), so the report should treat them as instability indicators or use alternative aggregations rather than relying on them as primary endpoints.

## Evidence-Backed Claims

1. **a6/a7 are structural outliers (conflict and geometry).**
   In `family_metrics.csv`, both `a6_bundle_5_l2` and `a7_bundle_5_l3` have much lower mean TBM conflict than every other family (`~0.23` vs `~0.94-1.00` for most families). In `experiment_metrics.csv`, the individual experiments show `mean_tbm_conflict` as low as `0.150` and `0.181` for GPT-5.2, which is the minimum across all V3 experiments. These families also show markedly lower singleton rates and higher mean subset sizes for GPT-4.1 (subset size ~`1.73` and singleton rate ~`0.38-0.44`). This is a high-value target for the report because it suggests bundling changes adjudicative geometry in a way not seen elsewhere.

2. **d1 control runs in a distinct abstain/specificity regime.**
   Control experiments have extreme `abstain_rate` (`0.80` for GPT-4.1, `0.8917` for GPT-5.2) and near-max `singleton_rate` (`0.9583` for GPT-4.1, `1.0` for GPT-5.2), with the smallest mean subset sizes in the entire matrix (`1.0-1.04`). This makes d1 valuable as a sanity anchor and as a “collapsed / gated” behavior mode to compare against the intervention families.

3. **Closed-world conflict being exactly 0.0 for d1 is a diagnostic signal, not an absence of uncertainty.**
   In `experiment_metrics.csv`, `mean_closed_world_conflict` is `0.0` for both control experiments while TBM conflict remains high (`0.916-0.967`). Under the current analysis rules (see `paper.md` methodology and the closed-world mass definition), closed-world conflict can be 0 when the remaining non-abstained responses behave like pure ignorance (e.g., full-frame subset selections) or when evidence-level masses combine without contradiction after abstentions are dropped. This should be explicitly interpreted; otherwise readers will mistake “0 conflict” for “high agreement.”

4. **a1 abstention gate yields large, model-dependent abstain-rate deltas with coherent second-order effects.**
   In `experiment_metrics.csv`, enabling abstention increases abstain rate by `+0.2017` for GPT-4.1 and `+0.4383` for GPT-5.2. It also decreases singleton rate by ~`0.05-0.06` and increases mean subset size by ~`0.03-0.06`. The effect is directionally consistent across both models, but materially larger for GPT-5.2. This is a clean, interpretable “causal” family worth emphasizing early.

5. **a4 rubric-vs-scoring swap is unusually reportable because it isolates two mechanisms.**
   The swap experiments are:
   - rubric=GPT-4.1, scorer=GPT-5.2: `abstain_rate=0.4233`, `mean_score_expert_agreement_prob=0.7587`, high rubric quality (`obs=0.97`, `disc=0.97`).
   - rubric=GPT-5.2, scorer=GPT-4.1: `abstain_rate=0.16`, `mean_score_expert_agreement_prob=0.9344`, lower rubric quality (`obs=0.751`, `disc=0.705`).
   This creates a narrative lever: scoring behavior (abstention/specificity) appears strongly influenced by the scorer model even when rubric quality is high, while rubric quality differences likely affect the agreement/conflict measures. This family should be front-and-center because it directly addresses “rubric quality vs scorer geometry.”

6. **Rubric quality is a likely confound across families and should be treated as a covariate or stratification factor.**
   Across the matrix, GPT-4.1 tends to have higher rubric observability/discriminability than GPT-5.2. The most extreme gap is in a6/a7 where GPT-4.1 has `disc ~0.97-0.99` while GPT-5.2 has `disc ~0.685-0.706`. Any report that compares families without controlling for rubric quality risks attributing differences to interventions that are actually driven by rubric quality shifts.

7. **a2 (l3 abstraction) looks like it increases abstention strongly for GPT-5.2 relative to GPT-4.1.**
   In `experiment_metrics.csv`, the two `a2` experiments have abstain rates `0.2067` (GPT-4.1) vs `0.4783` (GPT-5.2). This suggests abstraction-level is a strong lever but potentially interacts with model training/alignment regimes. Because there is no explicit `l2` baseline in the same family, this should be reported as a comparative (model interaction) finding, not a single-factor causal claim.

8. **Small-model family b1 has warning signs for “answering when should abstain.”**
   `v3_b1_gpt_5_2_chat_abstain_false` has `abstain_rate=0.0` but the minimum `mean_score_expert_agreement_prob` in the matrix (~`0.657`). This is compatible with the broader abstention literature’s claim that abstention is not solved and can degrade under some training regimes; it is likely reportable as a reliability risk for using smaller/cheaper judges without explicit abstain gating. (External context: AbstentionBench.)

9. **Many families saturate TBM conflict near 1.0, so conflict should not be the sole headline metric.**
   Outside a6/a7, many experiments have `mean_tbm_conflict` close to `1.0`, and the earlier pilot docs already warn about conflict filtering and geometry-based interpretation rather than naive aggregation. For V3, the report should either (a) treat high conflict as a “instability / contradiction” regime indicator, (b) apply conflict filtering thresholds (as in `v2_engine_prototype_testing.md` and `paper.md`), or (c) use alternative aggregations (e.g., per-sample medians, trimmed means, or non-conjunctive pooling).

10. **External grounding: abstention/refusal is known to be a central confound and remains unsolved.**
   AbstentionBench and recent surveys emphasize that abstention is critical for reliability, that evaluation requires unanswerable/underspecified/stale-data scenarios, and that models often fail to abstain appropriately; reasoning fine-tuning can degrade abstention and prompts can only partially mitigate. This supports treating abstain behavior in V3 as a first-class axis and not merely a nuisance rate.

## What Looks Most Promising for the First Report

- **Highest priority families:** `a6`, `a7`, `a1`, `a4`, `d1`.
  - a6/a7: strongest geometric shift signals and outlier conflict regime.
  - a1: clean on/off intervention with model interaction.
  - a4: mechanism decomposition (rubric quality vs scorer behavior).
  - d1: interpretability anchor and “collapsed regime” baseline.
- **Secondary families:** `a3`, `a5`, `b1`, `a2`.
  - likely important, but signal needs matched deltas/controls to avoid overclaiming.

## Uncertainty / Counterevidence / Caveats

- **Conflict saturation** suggests the current TBM aggregation is harsh; high conflict may be driven by conjunctively combining many evidence-level responses per sample rather than “true” instability. This makes conflict a useful “red flag” but a poor sole summary.
- **Rubric quality confounding** may explain part of the model/family differences; causal attribution requires stratifying/adjusting by rubric observability/discriminability.
- **Family comparability gaps:** Some families are not full factorial (e.g., a2 lacks direct l2 baseline), so conclusions must be framed as interactions or comparative results.
