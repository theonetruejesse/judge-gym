# Mining And Visualization Strategy For V3 Pilot Matrix

**Confidence:** 0.74

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v1_distribution_exploration.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v2_engine_prototype_testing.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/paper.md
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/experiment_metrics.csv
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/overview/tables/family_metrics.csv
- https://www.jstor.org/stable/1268522 (Tukey, *Exploratory Data Analysis*, 1977)
- https://www.stat.columbia.edu/~gelman/research/published/p755.pdf (Gelman, “Exploratory Data Analysis for Complex Models”, 2004)
- https://stat.columbia.edu/~gelman/research/unpublished/p_hacking.pdf (Gelman & Loken, “The garden of forking paths”, 2013)
- https://www.jstor.org/stable/2346101 (Benjamini & Hochberg, “Controlling the false discovery rate”, 1995)
- https://hastie.su.domains/Papers/ESLII.pdf (Hastie, Tibshirani, Friedman, *The Elements of Statistical Learning*, 2e)
- https://link.springer.com/book/10.1007/978-0-387-28981-9 (Borg & Groenen, *Modern Multidimensional Scaling*, 2e)
- https://doi.org/10.1002/9780470316801 (Kaufman & Rousseeuw, *Finding Groups in Data*, 1990)

**Summary:**
This evidence memo describes how to mine the V3 pilot matrix (many experiments, shared 30 samples, multiple families) for robust findings and present them in a comprehensive report. The key theme is to make discovery and presentation primarily *table-driven* and *matched-sample*, and to explicitly separate exploratory mining from confirmatory claims.

Evidence-backed claims (with intended use in the V3 report and analysis scripts):

1. **Use sample-level matched comparisons as the core unit, not global means.**
   V3 has shared `sample_ordinal` across experiments (30 per experiment), which enables paired analysis within each family (e.g. `a1` abstain on/off). This supports cleaner effect estimates than comparing unpaired aggregates. Local evidence: each experiment in `experiment_metrics.csv` reports `sample_rows=30`. External grounding: EDA framing from Tukey (1977) and Gelman (2004) encourages discovering structure by conditioning on meaningful strata rather than collapsing. Sources: `experiment_metrics.csv`; Tukey 1977; Gelman 2004.

2. **Discovery should be driven by ranked “instability” and “sensitivity” tables, then visualized.**
   A practical mining workflow is: compute per-sample metrics, rank samples by cross-experiment variance (instability), rank evidence/bundles by delta magnitude within families (sensitivity), then generate “hero” plots only for top-ranked items. This reduces human cherry-picking and aligns with the idea that EDA is a systematic process, not a gallery. Sources: Tukey 1977; Gelman 2004; local pilot docs emphasize “adjudicative geometries” and “compression” patterns that should be surfaced via systematic metrics rather than ad-hoc chart scanning. Sources: `v2_engine_prototype_testing.md`.

3. **Separate exploratory mining from confirmatory reporting to avoid garden-of-forking-paths failure modes.**
   With many metrics, families, and plotting choices, the analysis space is large. Treat the first pass as EDA (explicitly labeled exploratory), and restrict any “headline” claims to a small set of predeclared endpoints or robust effect summaries. Gelman & Loken (2013) argue that p-hacking can arise even without intentional misconduct via multiplicity of analysis choices (“forking paths”). Sources: Gelman & Loken 2013.

4. **Control multiplicity explicitly for any statistical testing across many comparisons; prefer effect sizes + uncertainty.**
   For large sets of parallel tests (e.g., per-sample or per-evidence deltas across families), false discovery control is appropriate for exploratory prioritization. Benjamini-Hochberg (1995) provides a standard FDR procedure; use it as a ranking/filtering aid rather than proof. For presentation, include paired bootstrap CIs or permutation p-values per family, but keep the narrative anchored in effect size magnitude and consistency. Sources: Benjamini & Hochberg 1995; Gelman & Loken 2013.

5. **Build experiment distance views, but treat clustering as an exploratory map, not a result.**
   With 22 experiments and a consistent metric panel, you can compute an experiment–experiment distance matrix (e.g., Jensen-Shannon divergence on per-sample expected-stage distributions, or Euclidean distance on z-scored metric vectors). Visualize with: (a) clustered heatmaps (hierarchical clustering), (b) 2D MDS embeddings, and (c) per-family “paths” (baseline -> variant). Standard clustering texts and ESL suggest this is useful for exploration, but it can be unstable and sensitive to distance choice; report it as a map to guide follow-up analyses. Sources: Kaufman & Rousseeuw 1990; ESL; Borg & Groenen MDS.

6. **Use delta heatmaps and paired “slopegraphs” to show within-family effects at matched granularity.**
   For each family, compute `variant - baseline` per `sample_ordinal` for key metrics (abstain rate, singleton rate, mean subset size, expected stage) and plot: (a) sample-by-variant delta heatmaps, (b) paired scatter plots with diagonal reference line, and (c) slopegraphs across the two (or few) conditions. These visuals emphasize matched changes over raw distributions. Grounding: the V2 pilot narrative (“distinct adjudicative geometries”) implies family-level comparisons should reveal geometry shifts; these plots are designed to surface that. Sources: `v2_engine_prototype_testing.md`; Tukey 1977.

7. **Normalize comparisons across families with different response-row counts by moving to a common unit (sample, evidence-item, or score target).**
   Local evidence shows `a6/a7/d1` families have `response_rows=120` vs `600` elsewhere, and `unique_bundle_count` differs (`120` vs `20`), meaning naive pooling can overweight some families or misinterpret density. The analysis should compute per-sample metrics (or per-evidence metrics) and then aggregate across samples, ensuring consistent denominators. Sources: `experiment_metrics.csv`; `family_metrics.csv`.

8. **Evidence sensitivity analysis should include “drivers” and “robustness”: which evidence/bundles dominate differences.**
   For each family, compute which evidence labels/bundles contribute most to the family delta (e.g., via decomposition of mean delta by evidence), and report the top drivers alongside robustness checks (e.g., re-aggregate with drivers removed to see if the effect remains). This is aligned with the pilots’ repeated emphasis on “evidence distribution artifacts” and “framework sensitivity” as alternative explanations. Sources: `v2_engine_prototype_testing.md`; `paper.md`.

9. **Add instability dashboards: (a) sample instability, (b) evidence instability, (c) intervention instability.**
   Recommended derived tables:
   - `sample_instability`: across-experiment variance of expected stage / abstain / subset size per sample.
   - `evidence_instability`: within-family delta variance per evidence label/bundle.
   - `intervention_profile`: vector of effect sizes per family and model.
   These tables make it possible to mine insights via code, not manual figure browsing, and they align with the repo’s goal of reproducible analysis scripts rather than notebooks. Sources: local V3 overview tables; Tukey 1977; Gelman 2004.

Uncertainty / counterevidence:

- **Clustering can be misleading** when distances are dominated by a few metrics (e.g., abstain rate) or when scaling differs across families. This is why clustering is framed as a map that must be validated by returning to matched deltas and per-sample distributions. Sources: general clustering limitations discussed in standard clustering texts (Kaufman & Rousseeuw 1990; ESL).
- **FDR control doesn’t “fix” exploratory bias**; it only controls expected false discoveries under specific assumptions. For a pilot, the main value is disciplined ranking and explicit labeling, not formal inference. Sources: BH 1995; Gelman & Loken 2013.
- **Choice of unit matters**: sample-level aggregation may hide evidence-item heterogeneity; evidence-level aggregation may hide sample-specific rubric effects. The report should include both, but sample-first is recommended as the primary matched unit given the experimental design (30 shared samples). Sources: local V3 tables and pilot narrative emphasizing rubric stochasticity in `paper.md`.

