# judge-gym analysis

Script-first analysis package for exporting completed Convex runs into a local SQLite cache and generating report artifacts without notebooks.

## Workflow

1. Export completed experiment runs from Convex into the cache:

```bash
cd packages/analysis
uv run judge-gym-analysis export \
  --convex-url https://<deployment>.convex.cloud \
  --experiment-tag <tag> \
  --experiment-tag <tag>
```

2. Generate a single bundle report from cached snapshots:

```bash
cd packages/analysis
uv run judge-gym-analysis pilot-report \
  --experiment-tag <tag> \
  --experiment-tag <tag>
```

3. Generate the V3 investigation tables and markdown findings report from cached snapshots:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-investigate --all-completed
```

By default the cache lives at `packages/analysis/_cache/analysis.sqlite`, and generated artifacts are written under `packages/analysis/_outputs/v3/`.

## Pilot Runner

For the full export-and-report flow in one step:

```bash
cd packages/analysis
uv run python notebooks/pilot_v3.py --all-completed
```

Or target specific experiments:

```bash
cd packages/analysis
uv run python notebooks/pilot_v3.py \
  --experiment-tag v3_a1_gpt_4_1_abstain_true \
  --experiment-tag v3_a1_gpt_5_2_abstain_true
```

The runner writes a V3 suite with three layers:

- `packages/analysis/_outputs/v3/overview/` for cross-experiment summary tables and heatmaps
- `packages/analysis/_outputs/v3/experiments/<experiment_tag>/` for single-experiment drilldowns
- `packages/analysis/_outputs/v3/families/<family_slug>/` for family-level matched comparisons

By default it also writes an investigation pass under `packages/analysis/_outputs/v3/investigation/` containing:

- matched family effect tables
- adjudicative geometry heatmaps
- semantic rubric embedding tables, clustering outputs, and similarity heatmaps
- stage-level rubric similarity tables
- scale-size versus certainty tables and figures
- sample instability tables
- experiment distance tables
- candidate finding rankings
- `report.md` with first-pass findings

The default local rubric embedder is `BAAI/bge-small-en-v1.5`, cached under `packages/analysis/_cache/`.

Belief/conflict exports are aggregated at the sample/rubric level across all score responses for that sample, rather than one row per raw score target.

## Modules

- `judge_gym.export` — public Convex HTTP client plus export orchestration
- `judge_gym.cache` — SQLite schema, snapshot metadata, and artifact registry
- `judge_gym.datasets` — cached snapshot loaders that return pandas frames
- `judge_gym.report_pilot` — file-writing pilot analysis pipeline
- `judge_gym.collect` — convenience wrapper that exports and loads experiments in one call

## Testing

```bash
cd packages/analysis
uv run python -m unittest discover -s tests
```
