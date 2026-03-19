# Report Architecture and Figure Triage

**Confidence:** 0.82

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/curated/hero_contrast_heatmap.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_effect_heatmap.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/rubric_stage_similarity_heatmap.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_verdict_heatmaps/c7_bundle_5_cluster_l2_scale_9_verdict_distribution.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/figures/family_belief_heatmaps/c7_bundle_5_cluster_l2_scale_9_closed_world_belief.png
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/investigate_v3.py
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md
- https://wilkelab.org/DSC385/slides/compound-figures.html
- https://us.sagepub.com/sites/default/files/upm-binaries/102337_Ch01_27.pdf

**Summary:**
The current V3 investigation output is too large to serve directly as a final report surface. The curated figures are consistently legible, while several matrix-style heatmaps are exploratory-only because they combine too many labels, rows, and annotations into a single canvas.

The main readability failures are annotation density, long axis labels, and verdict-category explosion at high scale sizes. Verdict-distribution heatmaps become especially hard to interpret once scale size rises and the number of subset verdict categories grows. In contrast, belief heatmaps remain readable because they compress the x-axis to ordered stages.

The right architecture is therefore a two-tier figure system: a small report-grade hero set, and a larger exploratory appendix/drilldown layer. Report-grade figures should preserve common scales and small multiples, while giant matrices should be demoted unless they are split, aggregated, or stripped of dense annotations.
