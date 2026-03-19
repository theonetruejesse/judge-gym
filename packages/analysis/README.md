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

4. Freeze and validate the contract-driven V3 slice:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-contract-check \
  --contract ../../_blueprints/v3-analysis-process/analysis_contract.json \
  --figure-manifest ../../_blueprints/v3-analysis-process/figures_manifest.json
```

5. Run the V3 investigation against the frozen contract instead of ad hoc tag selection:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-investigate \
  --contract ../../_blueprints/v3-analysis-process/analysis_contract.json \
  --figure-manifest ../../_blueprints/v3-analysis-process/figures_manifest.json
```

6. Assemble the contract-driven markdown report:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-report \
  --contract ../../_blueprints/v3-analysis-process/analysis_contract.json \
  --figure-manifest ../../_blueprints/v3-analysis-process/figures_manifest.json \
  --output-path _outputs/v3/investigation/v3_contract_report.md
```

7. Print the current figure repair plan from the manifest:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-figure-plan \
  --figure-manifest ../../_blueprints/v3-analysis-process/figures_manifest.json
```

8. Mine ranked findings from the frozen canonical tables:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-mine \
  --contract ../../_blueprints/v3-analysis-process/analysis_contract.json \
  --output-dir _outputs/v3/investigation/tables
```

9. Compute aggregation-sensitivity tables from the same frozen slice:

```bash
cd packages/analysis
uv run judge-gym-analysis v3-aggregation-sensitivity \
  --contract ../../_blueprints/v3-analysis-process/analysis_contract.json \
  --output-dir _outputs/v3/investigation/tables
```

By default the cache lives at `packages/analysis/_cache/analysis.sqlite`, and generated artifacts are written under `packages/analysis/_outputs/v3/`.

The cache persists both bundled response rows and an exploded `analysis_response_items` table. That makes clustering-aware follow-up analysis possible without re-querying Convex or rebuilding per-evidence rows from raw arrays each time.

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
- ranked mining outputs (`mine_v3_ranked_findings.csv`, `mine_v3_summary.md`)
- aggregation sensitivity tables across geometry-first, linear/log pools, and local belief variants
- `report.md` with first-pass findings

The default local rubric embedder is `BAAI/bge-small-en-v1.5`, cached under `packages/analysis/_cache/`.

Belief/conflict exports are aggregated at the sample/rubric level across all score responses for that sample, rather than one row per raw score target.

## Modules

- `judge_gym.export` — public Convex HTTP client plus export orchestration
- `judge_gym.cache` — SQLite schema, snapshot metadata, and artifact registry
- `judge_gym.analysis_contract` — frozen contract and contrast-registry validation
- `judge_gym.datasets` — cached snapshot loaders that return pandas frames, including contract-aware loading
- `judge_gym.figure_triage` — figure manifest loading, categorization, and repair planning
- `judge_gym.aggregation_methods` — geometry-first summaries and alternative aggregation baselines
- `judge_gym.aggregation_sensitivity` — contract-aware aggregation sensitivity tables and report panel exports
- `judge_gym.mine_v3` — ranked findings, top unstable samples, and markdown mining summary
- `judge_gym.report_pilot` — file-writing pilot analysis pipeline
- `judge_gym.report_v3` — contract-driven markdown report assembly
- `judge_gym.collect` — convenience wrapper that exports and loads experiments in one call

## Testing

```bash
cd packages/analysis
uv run python -m unittest discover -s tests
```
