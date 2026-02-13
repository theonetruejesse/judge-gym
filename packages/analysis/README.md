# judge-gym analysis

- [] todo, regression on evidence

---

Statistical analysis package for the judge-gym LLM-as-Judge design space engine.

## Modules

- `collect.py` — Pull experiment data from Convex via HTTP API into DataFrames
- `metrics.py` — JSD polarization, entrenchment index, sensitivity analyses
- `dempster_shafer.py` — DST aggregation, belief/plausibility, cross-model conflict
- `regression.py` — OLS regression models

## Setup

```bash
uv sync
```
