# Aggregation Alternatives Beyond DST/TBM

**Confidence:** 0.8

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/report_pilot.py
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/tables/bundle_belief_tbm.csv
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md
- https://www.sciencedirect.com/science/article/pii/S0004370207001063
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12468343/
- https://www.sciencedirect.com/science/article/pii/S1566253508000444
- https://www.tandfonline.com/doi/abs/10.1080/01621459.1981.10477661
- https://oro.open.ac.uk/28320/
- https://studyres.com/doc/8875501/evaluating-ensemble-density-combination-%E2%80%93-forecasting-gdp...

**Summary:**
The current analysis uses TBM and closed-world DST-family aggregation, but the local evidence and the broader literature both indicate that standard Dempster-style conjunctive fusion becomes fragile when sources overlap or are dependent. That is likely true in this project because evidence groups and model judgments are not cleanly independent witnesses.

DST/TBM still has value for representing abstention, ignorance, and set-valued judgments, but it should be demoted to a diagnostic lens rather than the main stance summary. The most defensible primary aggregation baseline is a weighted linear opinion pool over stage distributions, with weights derived from expert-agreement and possibly rubric quality. A logarithmic pool is useful as a sensitivity check, and conflict-aware/idempotent DST-family rules such as cautious combination are better local diagnostics than global conjunctive fusion.

The most important structural change is to keep aggregation local when possible: per evidence group or per small bundle rather than global fusion over many dependent sources. This preserves some interpretability of conflict while reducing mechanical fan-in artifacts.
