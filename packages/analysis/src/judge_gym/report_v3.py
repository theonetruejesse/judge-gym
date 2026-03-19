from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .contracts import resolve_repo_path
from .report_templates import format_bullet_lines, format_markdown_table, format_path


class V3ReportAssemblyError(ValueError):
    """Raised when contract or manifest inputs are invalid for report assembly."""


@dataclass(frozen=True)
class CsvSnapshot:
    path: Path
    exists: bool
    columns: list[str]
    rows: list[dict[str, str]]
    row_count: int


def assemble_v3_report(
    *,
    contract_path: str | Path,
    figure_manifest_path: str | Path,
    output_path: str | Path,
    max_rows_per_section: int = 12,
) -> Path:
    contract_file = Path(contract_path).resolve()
    manifest_file = Path(figure_manifest_path).resolve()
    if not contract_file.exists():
        raise V3ReportAssemblyError(f"Contract not found: {contract_file}")
    if not manifest_file.exists():
        raise V3ReportAssemblyError(f"Figure manifest not found: {manifest_file}")

    contract = _load_json_file(contract_file)
    manifest = _load_json_file(manifest_file)
    _validate_contract(contract)
    _validate_manifest(manifest)

    registry_path = _resolve_relative_path(contract["contrastRegistry"]["path"], contract_file.parent)
    if not registry_path.exists():
        raise V3ReportAssemblyError(f"Contrast registry not found: {registry_path}")
    contrast_registry = _load_json_file(registry_path)
    if "contrasts" not in contrast_registry or not isinstance(contrast_registry["contrasts"], list):
        raise V3ReportAssemblyError("Contrast registry is missing a valid `contrasts` list.")

    outputs_root = _resolve_relative_path(contract["outputs"]["investigationRoot"], contract_file.parent)
    tables_root = outputs_root / "tables"

    primary_endpoints = [str(value) for value in contract["endpoints"]["primary"]]
    inferential_ids, descriptive_ids = _contrast_modes(contrast_registry)

    family_effects = _read_csv_snapshot(tables_root / "family_effects.csv", max_rows=100000)
    matching_validation = _read_csv_snapshot(tables_root / "matching_validation.csv", max_rows=100000)
    sample_instability = _read_csv_snapshot(
        tables_root / "sample_instability.csv",
        max_rows=max(int(contract["spotChecks"]["topKUnstableSamples"]), max_rows_per_section),
    )
    scale_certainty_effects = _read_csv_snapshot(
        tables_root / "scale_certainty_effects.csv",
        max_rows=max_rows_per_section * 2,
    )
    scale_certainty_regression = _read_csv_snapshot(
        tables_root / "scale_certainty_regression.csv",
        max_rows=max_rows_per_section * 2,
    )
    mining_ranked_findings = _read_csv_snapshot(
        tables_root / "mine_v3_ranked_findings.csv",
        max_rows=max_rows_per_section * 2,
    )
    aggregation_report_panel = _read_csv_snapshot(
        tables_root / "aggregation_sensitivity_report_panel.csv",
        max_rows=max_rows_per_section * 2,
    )

    inferential_rows = _select_effect_rows(
        family_effects,
        contrast_ids=inferential_ids,
        endpoints=primary_endpoints,
        max_rows=max_rows_per_section,
    )
    descriptive_rows = _select_effect_rows(
        family_effects,
        contrast_ids=descriptive_ids,
        endpoints=primary_endpoints,
        max_rows=max_rows_per_section,
    )

    table_status = _canonical_table_status(contract=contract, tables_root=tables_root, contract_base=contract_file.parent)
    figure_inventory = _group_figures(manifest["figures"])
    top_unstable_samples = _top_unstable_rows(sample_instability, int(contract["spotChecks"]["topKUnstableSamples"]))
    matching_summary = _matching_summary(
        matching_validation,
        inferential_count=len(inferential_ids),
        descriptive_count=len(descriptive_ids),
    )
    sensitivity_rows = _select_scale_sensitivity_rows(scale_certainty_effects, max_rows=max_rows_per_section)
    mined_rows = _select_ranked_findings_rows(mining_ranked_findings, max_rows=max_rows_per_section)
    aggregation_rows = _select_aggregation_rows(aggregation_report_panel, max_rows=max_rows_per_section)

    markdown = _build_report_markdown(
        contract=contract,
        manifest=manifest,
        registry=contrast_registry,
        inferential_rows=inferential_rows,
        descriptive_rows=descriptive_rows,
        matching_summary=matching_summary,
        top_unstable_samples=top_unstable_samples,
        sensitivity_rows=sensitivity_rows,
        sensitivity_regression=scale_certainty_regression.rows,
        mined_rows=mined_rows,
        aggregation_rows=aggregation_rows,
        table_status=table_status,
        figure_inventory=figure_inventory,
        contract_file=contract_file,
        manifest_file=manifest_file,
    )

    target = Path(output_path).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(markdown)
    return target


def _build_report_markdown(
    *,
    contract: dict[str, Any],
    manifest: dict[str, Any],
    registry: dict[str, Any],
    inferential_rows: list[dict[str, str]],
    descriptive_rows: list[dict[str, str]],
    matching_summary: dict[str, Any],
    top_unstable_samples: list[dict[str, str]],
    sensitivity_rows: list[dict[str, str]],
    sensitivity_regression: list[dict[str, str]],
    mined_rows: list[dict[str, str]],
    aggregation_rows: list[dict[str, str]],
    table_status: list[dict[str, str]],
    figure_inventory: dict[str, list[dict[str, Any]]],
    contract_file: Path,
    manifest_file: Path,
) -> str:
    inferential_table = format_markdown_table(
        rows=inferential_rows,
        columns=["contrast_id", "endpoint", "mean_delta", "ci_low", "ci_high", "sign_flip_pvalue"],
    )
    descriptive_table = format_markdown_table(
        rows=descriptive_rows,
        columns=["contrast_id", "endpoint", "mean_delta", "ci_low", "ci_high", "sign_flip_pvalue"],
    )
    unstable_table = format_markdown_table(
        rows=top_unstable_samples,
        columns=["sample_ordinal", "instability_score", "experiment_count", "abstain_rate_std", "mean_subset_size_std"],
    )
    sensitivity_table = format_markdown_table(
        rows=sensitivity_rows,
        columns=[
            "contrast_id",
            "model_id",
            "baseline_scale_size",
            "variant_scale_size",
            "endpoint",
            "mean_delta",
            "ci_low",
            "ci_high",
        ],
    )
    regression_table = format_markdown_table(
        rows=sensitivity_regression[:10],
        columns=["term", "coef", "stderr", "pvalue", "conf_low", "conf_high", "r_squared", "n_obs"],
    )
    mining_table = format_markdown_table(
        rows=mined_rows,
        columns=["finding_scope", "finding_type", "rank_score", "direction", "summary"],
    )
    aggregation_table = format_markdown_table(
        rows=aggregation_rows,
        columns=["method", "n_samples", "mean_expected_stage", "mean_entropy_norm", "mean_top1_prob", "mean_conflict"],
    )
    canonical_table = format_markdown_table(
        rows=table_status,
        columns=["table", "status", "path", "rows", "columns"],
    )

    figure_lines: list[str] = []
    for tier in ["hero", "report", "appendix", "exploratory", "discard"]:
        figures = figure_inventory.get(tier, [])
        if not figures:
            continue
        figure_lines.append(f"### `{tier}`")
        for figure in figures:
            status = str(figure.get("readability", {}).get("status", "unknown"))
            known_issues = figure.get("readability", {}).get("knownIssues", [])
            issues_text = f" issues={'; '.join(known_issues)}" if known_issues else ""
            figure_lines.append(
                f"- `{figure.get('figureId')}` -> `{figure.get('path')}` (`{status}`){issues_text}"
            )

    summary_lines = [
        f"contract version `{contract.get('contractVersion')}`",
        f"schema `{contract.get('dataSource', {}).get('exportSchemaVersion')}`",
        f"snapshots `{len(contract.get('dataSource', {}).get('snapshotIds', []))}`",
        f"included tags `{len(contract.get('inclusion', {}).get('includeTags', []))}`",
        f"excluded tags `{len(contract.get('inclusion', {}).get('excludeTags', []))}`",
        f"contrasts `{len(registry.get('contrasts', []))}`",
        f"inferential contrasts `{matching_summary['inferential_count']}`",
        f"descriptive contrasts `{matching_summary['descriptive_count']}`",
        f"fully matched `{matching_summary['fully_matched_count']}`",
    ]

    return "\n".join(
        [
            "# V3 Contract Report",
            "",
            f"_Generated: {datetime.now(tz=UTC).isoformat()}_",
            "",
            "## Inputs",
            "",
            format_bullet_lines(
                [
                    f"contract: `{format_path(contract_file)}`",
                    f"figure manifest: `{format_path(manifest_file)}`",
                    f"investigation root: `{contract['outputs']['investigationRoot']}`",
                    f"contrast registry: `{contract['contrastRegistry']['path']}`",
                ]
            ),
            "",
            "## Contract Snapshot",
            "",
            format_bullet_lines(summary_lines),
            "",
            "## Inferential Findings",
            "",
            inferential_table,
            "",
            "## Descriptive Findings",
            "",
            descriptive_table,
            "",
            "## Spot Checks",
            "",
            "Top unstable samples from `sample_instability.csv` using contract `topKUnstableSamples`.",
            "",
            unstable_table,
            "",
            "## Mining Snapshot",
            "",
            mining_table,
            "",
            "## Aggregation Sensitivity",
            "",
            "Scale/certainty effect rows:",
            "",
            sensitivity_table,
            "",
            "Method summary rows:",
            "",
            aggregation_table,
            "",
            "Regression summary rows:",
            "",
            regression_table,
            "",
            "## Canonical Table Status",
            "",
            canonical_table,
            "",
            "## Appendix Figure Inventory",
            "",
            "\n".join(figure_lines) if figure_lines else "_No figures listed in manifest._",
            "",
        ]
    )


def _load_json_file(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise V3ReportAssemblyError(f"Expected object JSON in {path}")
    return data


def _validate_contract(contract: dict[str, Any]) -> None:
    required = ["dataSource", "inclusion", "contrastRegistry", "endpoints", "spotChecks", "outputs"]
    missing = [key for key in required if key not in contract]
    if missing:
        raise V3ReportAssemblyError(f"Analysis contract missing keys: {', '.join(missing)}")


def _validate_manifest(manifest: dict[str, Any]) -> None:
    if "figures" not in manifest or not isinstance(manifest["figures"], list):
        raise V3ReportAssemblyError("Figure manifest missing `figures` list.")


def _resolve_relative_path(reference: str | Path, base_dir: Path) -> Path:
    candidate = Path(reference)
    if candidate.is_absolute():
        return candidate
    first = (base_dir / candidate).resolve()
    if first.exists():
        return first
    from_cwd = (Path.cwd() / candidate).resolve()
    if from_cwd.exists():
        return from_cwd
    return resolve_repo_path(candidate)


def _read_csv_snapshot(path: Path, *, max_rows: int) -> CsvSnapshot:
    if not path.exists():
        return CsvSnapshot(path=path, exists=False, columns=[], rows=[], row_count=0)

    rows: list[dict[str, str]] = []
    columns: list[str] = []
    row_count = 0
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        columns = list(reader.fieldnames or [])
        for row in reader:
            row_count += 1
            if len(rows) < max_rows:
                rows.append({key: value for key, value in row.items()})
    return CsvSnapshot(path=path, exists=True, columns=columns, rows=rows, row_count=row_count)


def _contrast_modes(registry: dict[str, Any]) -> tuple[set[str], set[str]]:
    inferential_ids: set[str] = set()
    descriptive_ids: set[str] = set()
    for item in registry.get("contrasts", []):
        contrast_id = str(item.get("contrastId", ""))
        mode = str(item.get("mode", "inferential"))
        if not contrast_id:
            continue
        if mode == "descriptive_only":
            descriptive_ids.add(contrast_id)
        else:
            inferential_ids.add(contrast_id)
    return inferential_ids, descriptive_ids


def _select_effect_rows(
    snapshot: CsvSnapshot,
    *,
    contrast_ids: set[str],
    endpoints: list[str],
    max_rows: int,
) -> list[dict[str, str]]:
    if not snapshot.exists or not snapshot.rows:
        return []
    endpoint_set = set(endpoints)
    selected: list[dict[str, str]] = []
    for row in snapshot.rows:
        if row.get("contrast_id", "") not in contrast_ids:
            continue
        if endpoint_set and row.get("endpoint", "") not in endpoint_set:
            continue
        selected.append(row)

    def magnitude(item: dict[str, str]) -> float:
        try:
            return abs(float(item.get("mean_delta", "0")))
        except ValueError:
            return 0.0

    selected.sort(key=magnitude, reverse=True)
    return selected[:max_rows]


def _matching_summary(snapshot: CsvSnapshot, *, inferential_count: int, descriptive_count: int) -> dict[str, int]:
    fully_matched_count = 0
    if snapshot.exists:
        for row in snapshot.rows:
            if str(row.get("fully_matched", "")).lower() == "true":
                fully_matched_count += 1
    return {
        "fully_matched_count": fully_matched_count,
        "inferential_count": inferential_count,
        "descriptive_count": descriptive_count,
    }


def _top_unstable_rows(snapshot: CsvSnapshot, top_k: int) -> list[dict[str, str]]:
    if not snapshot.exists or not snapshot.rows:
        return []

    def instability(item: dict[str, str]) -> float:
        try:
            return float(item.get("instability_score", "0"))
        except ValueError:
            return 0.0

    rows = sorted(snapshot.rows, key=instability, reverse=True)
    return rows[:top_k]


def _select_scale_sensitivity_rows(snapshot: CsvSnapshot, *, max_rows: int) -> list[dict[str, str]]:
    if not snapshot.exists or not snapshot.rows:
        return []
    preferred = [row for row in snapshot.rows if row.get("endpoint") in {"abstain_rate", "mean_score_expert_agreement_prob", "tbm_conflict", "closed_world_conflict"}]
    rows = preferred if preferred else snapshot.rows

    def magnitude(item: dict[str, str]) -> float:
        try:
            return abs(float(item.get("mean_delta", "0")))
        except ValueError:
            return 0.0

    rows = sorted(rows, key=magnitude, reverse=True)
    return rows[:max_rows]


def _select_ranked_findings_rows(snapshot: CsvSnapshot, *, max_rows: int) -> list[dict[str, str]]:
    if not snapshot.exists or not snapshot.rows:
        return []

    def rank_score(item: dict[str, str]) -> float:
        try:
            return float(item.get("rank_score", "0"))
        except ValueError:
            return 0.0

    rows = sorted(snapshot.rows, key=rank_score, reverse=True)
    return rows[:max_rows]


def _select_aggregation_rows(snapshot: CsvSnapshot, *, max_rows: int) -> list[dict[str, str]]:
    if not snapshot.exists or not snapshot.rows:
        return []
    return snapshot.rows[:max_rows]


def _canonical_table_status(*, contract: dict[str, Any], tables_root: Path, contract_base: Path) -> list[dict[str, str]]:
    expected = [
        "contrast_registry.csv",
        "matching_validation.csv",
        "family_effects.csv",
        "family_effects_qvalues.csv",
        "candidate_findings.csv",
        "mine_v3_ranked_findings.csv",
        "sample_instability.csv",
        "verdict_geometry_certainty.csv",
        "bundle_policy_deltas.csv",
        "robust_summary_panel.csv",
        "aggregation_sensitivity_report_panel.csv",
    ]
    rows: list[dict[str, str]] = []
    for table_name in expected:
        if table_name == "contrast_registry.csv":
            registry_path = _resolve_relative_path(contract["contrastRegistry"]["path"], contract_base)
            exists = registry_path.exists()
            rows.append(
                {
                    "table": table_name,
                    "status": "present" if exists else "missing",
                    "path": format_path(registry_path),
                    "rows": "-" if not exists else "n/a",
                    "columns": "-" if not exists else "n/a",
                }
            )
            continue

        path = tables_root / table_name
        snapshot = _read_csv_snapshot(path, max_rows=1)
        rows.append(
            {
                "table": table_name,
                "status": "present" if snapshot.exists else "missing",
                "path": format_path(path),
                "rows": str(snapshot.row_count) if snapshot.exists else "-",
                "columns": str(len(snapshot.columns)) if snapshot.exists else "-",
            }
        )
    return rows


def _group_figures(figures: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in figures:
        tier = str(item.get("tier", "exploratory"))
        grouped.setdefault(tier, []).append(item)
    for tier, values in grouped.items():
        values.sort(key=lambda item: str(item.get("figureId", "")))
    return grouped
