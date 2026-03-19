# Figure Triage Evidence for V3 Analysis Outputs

**Confidence:** 0.78

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/summary.json
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/c7_bundle_5_cluster_l2_scale_9_verdict_distribution.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/experiment_adjudicative_heatmap.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/investigate_v3.py
- Cleveland & McGill (1984), JASA: Graphical Perception (DOI page): https://www.tandfonline.com/doi/abs/10.1080/01621459.1984.10478080
- Heer & Bostock (2010), CHI: Crowdsourcing Graphical Perception (PDF host): https://idl.uw.edu/papers/crowdsourcing-graphical-perception
- Wilke, *Fundamentals of Data Visualization* (book site): https://clauswilke.com/dataviz/index.html
- Tufte, *Envisioning Information* (book / small multiples emphasis): https://www.edwardtufte.com/book/envisioning-information/

**Summary:**
1. The current V3 investigation output is large (summary reports 53 figures), meaning manual browsing is inherently high-friction; it should be partitioned into exploratory artifacts versus report-grade "hero" figures.
2. Some heatmaps are demonstrably unreadable due to label density and annotation overlap; the worst observed example is the scale-9 verdict distribution heatmap (`c7 ... scale_9`), where x-axis verdict labels and per-cell text overlap heavily.
3. Large multi-panel heatmaps (e.g., experiment geometry) remain readable only as exploratory summaries; the smallest effective report-grade subset should favor simpler encodings (small multiples, dot/interval plots) and limit annotation density.
4. Visualization perception research supports choosing encodings that rely on more accurate perceptual tasks (e.g., position/length over color-only gradients) and avoiding overloaded heatmaps for fine quantitative comparisons; this is directly relevant to the current annotated heatmaps.
