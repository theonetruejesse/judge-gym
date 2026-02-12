# Analysis Package State vs Intended Modules

**Confidence:** 0.74

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/analysis/README.md
- /Users/jesselee/dev/research/judge-gym/packages/analysis/notebooks (listing)
- /Users/jesselee/dev/research/judge-gym/packages/analysis/src/judge_gym (listing)

**Summary:**
The analysis README advertises modules for metrics (JSD, entrenchment, swap sensitivity) and DST aggregation, but the package currently contains only `collect.py` and `regression.py`, with a single `pilot_v2.ipynb` notebook. This indicates the analysis surface is incomplete relative to the methodology described in the blueprint/paper and needs alignment with the refactor’s data outputs.
