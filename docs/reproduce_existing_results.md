# Reuse the existing V3 and V4 results offline

This guide is for reading and reusing already-exported analysis artifacts. None of
the inspection commands below contacts Convex, Temporal, Railway, OpenAI, or any
other model/provider API. No credentials are needed.

> **Fresh-clone availability check:** the artifact directories must be present in
> the revision or artifact bundle you received. Check this before following links:
>
```bash
test -f apps/analysis/_outputs/v3/investigation/report.md \
  && test -f apps/analysis/_outputs/v4/native_openai_scale/report.md
```

The combined command exits successfully only when both reports are present. In a
shell, `echo $?` prints its status (`0` means both are present). If either path is absent, do not
try to recreate the underlying model results: obtain the exported artifact
bundle from the project maintainers.

## Sources of truth

All paths below are relative to the repository root.

### V3 investigation

Start with:

- [Narrative investigation report](../apps/analysis/_outputs/v3/investigation/report.md)
- [Contract-driven report](../apps/analysis/_outputs/v3/investigation/v3_contract_report.md)
- [Machine-readable summary](../apps/analysis/_outputs/v3/investigation/summary.json)
- [Tables directory](../apps/analysis/_outputs/v3/investigation/tables/)
- [Figures directory](../apps/analysis/_outputs/v3/investigation/figures/)

The summary records the included experiment tags, snapshot IDs, and output
counts. The frozen interpretation contract and figure inventory are:

- [V3 analysis contract](../_blueprints/v3-analysis-process/analysis_contract.json)
- [V3 figure manifest](../_blueprints/v3-analysis-process/figures_manifest.json)
- [V3 pilot write-up](pilots/v3_gpt_ablations.md)

Useful canonical tables include
[`family_effects.csv`](../apps/analysis/_outputs/v3/investigation/tables/family_effects.csv),
[`family_effects_qvalues.csv`](../apps/analysis/_outputs/v3/investigation/tables/family_effects_qvalues.csv),
[`experiment_geometry.csv`](../apps/analysis/_outputs/v3/investigation/tables/experiment_geometry.csv),
[`aggregation_sensitivity_report_panel.csv`](../apps/analysis/_outputs/v3/investigation/tables/aggregation_sensitivity_report_panel.csv),
and [`sample_instability.csv`](../apps/analysis/_outputs/v3/investigation/tables/sample_instability.csv).
For a quick visual overview, use the three images in
[`figures/curated/`](../apps/analysis/_outputs/v3/investigation/figures/curated/).

Treat the CSV/JSON files as the reusable data products. The Markdown reports
are interpretations of those products; PNGs are presentation outputs rather
than raw observations.

### V4 native OpenAI scale

Start with:

- [Narrative report](../apps/analysis/_outputs/v4/native_openai_scale/report.md)
- [Machine-readable summary](../apps/analysis/_outputs/v4/native_openai_scale/summary.json)
- [Experiment metrics](../apps/analysis/_outputs/v4/native_openai_scale/experiment_metrics.csv)
- [Contrast metrics](../apps/analysis/_outputs/v4/native_openai_scale/contrast_metrics.csv)
- [Matched item deltas](../apps/analysis/_outputs/v4/native_openai_scale/item_deltas.csv)
- [Evidence inventory](../apps/analysis/_outputs/v4/native_openai_scale/evidence_inventory.csv)

The evidence inventory is provenance metadata, not a committed copy of the 48 frozen source texts. The public bundle supports result and score inspection, but does not independently reproduce the exact evidence content.

The [canonical run manifest](pilots/v4_native_openai_canonical_runs.json) pins the
intended run for each matrix cell. The [V4 study note](pilots/v4_native_openai_scale.md)
describes the design. Use the manifest for provenance and the exported CSV/JSON
files for offline analysis; canonical run IDs alone are not the result data.

This V4 export contains tables and Markdown, but no figure directory. Any new
figure should therefore cite the CSV file and columns from which it was made.

## Credential-free checks and inspection

Run these from the repository root. They use only Python's standard library and
read local files.

### Verify the expected bundle

```bash
python3 - <<'PY'
from pathlib import Path

required = [
    "apps/analysis/_outputs/v3/investigation/report.md",
    "apps/analysis/_outputs/v3/investigation/v3_contract_report.md",
    "apps/analysis/_outputs/v3/investigation/summary.json",
    "apps/analysis/_outputs/v3/investigation/tables/family_effects.csv",
    "apps/analysis/_outputs/v3/investigation/figures/curated/hero_contrast_heatmap.png",
    "apps/analysis/_outputs/v4/native_openai_scale/report.md",
    "apps/analysis/_outputs/v4/native_openai_scale/summary.json",
    "apps/analysis/_outputs/v4/native_openai_scale/experiment_metrics.csv",
    "apps/analysis/_outputs/v4/native_openai_scale/contrast_metrics.csv",
    "apps/analysis/_outputs/v4/native_openai_scale/item_deltas.csv",
    "apps/analysis/_outputs/v4/native_openai_scale/evidence_inventory.csv",
    "_blueprints/v3-analysis-process/analysis_contract.json",
    "_blueprints/v3-analysis-process/figures_manifest.json",
    "docs/pilots/v4_native_openai_canonical_runs.json",
]
missing = [path for path in required if not Path(path).is_file()]
if missing:
    raise SystemExit("Missing expected files:\n- " + "\n- ".join(missing))
print(f"OK: {len(required)} expected files are present")
PY
```

### Inspect JSON summaries

```bash
python3 -m json.tool apps/analysis/_outputs/v3/investigation/summary.json | less
python3 -m json.tool apps/analysis/_outputs/v4/native_openai_scale/summary.json | less
```

`less` is optional; omit `| less` to print directly.

### Inspect CSV schemas and sample rows

```bash
python3 - <<'PY'
import csv
from pathlib import Path

paths = [
    Path("apps/analysis/_outputs/v3/investigation/tables/family_effects.csv"),
    Path("apps/analysis/_outputs/v4/native_openai_scale/experiment_metrics.csv"),
    Path("apps/analysis/_outputs/v4/native_openai_scale/contrast_metrics.csv"),
]
for path in paths:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        first = next(reader, None)
    print(f"\n{path}")
    print("columns:", reader.fieldnames)
    print("first row:", first)
PY
```

For downstream work, copy a CSV to a separate working directory or read it
without overwriting the canonical export. Preserve identifiers such as
`experiment_tag`, `contrast_id`, and matched-item keys when joining tables.

## Regeneration boundaries

### Safe: local inspection or derived work from exported files only

The commands in the preceding section are **inspection-only**. A custom script
that reads only the exported CSV/JSON files and writes to a new directory is
also offline-safe. For example, CSV-to-JSON conversion is cached/export-only:

```bash
python3 - <<'PY'
import csv, json
from pathlib import Path
src = Path("apps/analysis/_outputs/v4/native_openai_scale/contrast_metrics.csv")
out = Path("/tmp/judge-gym-v4-contrast-metrics.json")
with src.open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
out.write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(out)
PY
```

This does **not** regenerate the scientific results; it only changes the format
of an existing export.

### Cached-data regeneration: only with a separately supplied local cache

Some analysis CLI commands can derive reports from
`apps/analysis/_cache/analysis.sqlite`, but that cache is a separate local
artifact and is not interchangeable with the CSV/JSON exports. Before
considering any cache-based command, require this check to succeed:

```bash
# PRECONDITION ONLY — no network or paid call
 test -f apps/analysis/_cache/analysis.sqlite
```

Even when the cache exists, inspect the command implementation and dependencies
before running it: optional embedding/model assets may not be available offline,
and output commands may overwrite the existing export. This guide deliberately
does not prescribe a repository CLI regeneration command because the exported
CSV/JSON/PNG bundle is sufficient for reuse and the available cache cannot be
assumed in a fresh clone.

### Do not run for offline reuse

The following are **not offline reproduction commands** and must not be run when
the goal is credential-free reuse:

```bash
# DO NOT RUN: exports/refreshes from Convex.
uv run judge-gym-analysis export ...
uv run judge-gym-analysis v4-native-openai --refresh

# DO NOT RUN: launches or inspects the live V4 cohort.
bun run v4:launch:native-openai
bun run v4:launch:native-openai --live --allow-existing-set

# DO NOT RUN: development/control-plane processes.
bun dev
npx convex dev
scripts/run_convex.sh ...
```

Also avoid campaign launchers, Temporal workers, Railway deployment commands,
and any provider-facing evaluation command. They produce or retrieve new data;
they are unnecessary for reading the existing reports and may require
credentials or incur cost.

## Citation and reuse checklist

1. Record the repository revision (`git rev-parse HEAD`) and the exact relative
   artifact path.
2. Cite the V3 contract or V4 canonical run manifest alongside the table used.
3. State whether numbers came from a Markdown summary, JSON, or a particular CSV
   and preserve the original column names.
4. Write derived tables and figures outside the canonical `_outputs` directory,
   or to a clearly named new directory, so the source exports remain unchanged.
5. Do not claim that rerunning a provider produced these results: this workflow
   reuses frozen exports and performs no new inference.
