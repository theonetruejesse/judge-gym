from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


class FigureManifestError(ValueError):
    pass


ALLOWED_TIERS = {"hero", "report", "appendix", "exploratory", "discard"}
ALLOWED_READABILITY_STATUSES = {
    "report_grade",
    "appendix_grade",
    "borderline",
    "unreadable",
}

ISSUE_TRANSFORM_PLAYBOOK: dict[str, list[str]] = {
    "verdict-category explosion": ["bucket_verdicts_by_geometry", "paginate_facets"],
    "axis label overlap": ["rotate_or_shorten_labels", "paginate_facets"],
    "dense per-cell annotations": ["drop_cell_annotations_above_threshold"],
    "long contrast labels": ["shorten_contrast_labels", "paginate_by_family"],
    "multi-facet label density": ["reduce_facet_count", "promote_single_panel_only"],
    "x-axis crowding": ["facet_by_model_family", "restrict_to_top_unstable_samples"],
    "small text at reduced size": ["increase_canvas_size", "move_to_appendix"],
}


@dataclass(frozen=True)
class ReadabilitySpec:
    status: str
    known_issues: tuple[str, ...]
    repair_transforms: tuple[str, ...]


@dataclass(frozen=True)
class FigureSpec:
    figure_id: str
    tier: str
    path: str
    purpose: str
    inputs: tuple[str, ...]
    readability: ReadabilitySpec


@dataclass(frozen=True)
class FigureManifest:
    manifest_version: int
    created_at: str
    contract_path: str
    contract_hash: str
    figures: tuple[FigureSpec, ...]


def load_figure_manifest(
    manifest_path: str | Path,
    *,
    validate_paths: bool = False,
    repo_root: str | Path | None = None,
) -> FigureManifest:
    path = Path(manifest_path)
    payload = json.loads(path.read_text())
    manifest = _parse_manifest(payload)
    if validate_paths:
        root = Path(repo_root) if repo_root else path.resolve().parents[3]
        _validate_figure_paths(manifest, root)
    return manifest


def figures_by_tier(manifest: FigureManifest) -> dict[str, list[FigureSpec]]:
    grouped: dict[str, list[FigureSpec]] = {tier: [] for tier in sorted(ALLOWED_TIERS)}
    for figure in manifest.figures:
        grouped.setdefault(figure.tier, []).append(figure)
    return grouped


def figures_by_readability(manifest: FigureManifest) -> dict[str, list[FigureSpec]]:
    grouped: dict[str, list[FigureSpec]] = {status: [] for status in sorted(ALLOWED_READABILITY_STATUSES)}
    for figure in manifest.figures:
        grouped.setdefault(figure.readability.status, []).append(figure)
    return grouped


def select_figures(
    manifest: FigureManifest,
    *,
    tiers: set[str] | None = None,
    statuses: set[str] | None = None,
) -> list[FigureSpec]:
    filtered = list(manifest.figures)
    if tiers is not None:
        filtered = [figure for figure in filtered if figure.tier in tiers]
    if statuses is not None:
        filtered = [figure for figure in filtered if figure.readability.status in statuses]
    return filtered


def suggest_repairs_for_issues(known_issues: list[str] | tuple[str, ...]) -> list[str]:
    suggested: list[str] = []
    for issue in known_issues:
        for transform in ISSUE_TRANSFORM_PLAYBOOK.get(issue, []):
            if transform not in suggested:
                suggested.append(transform)
    return suggested


def build_repair_plan(manifest: FigureManifest) -> dict[str, list[str]]:
    plan: dict[str, list[str]] = {}
    for figure in manifest.figures:
        transforms = list(figure.readability.repair_transforms)
        for transform in suggest_repairs_for_issues(figure.readability.known_issues):
            if transform not in transforms:
                transforms.append(transform)
        if figure.readability.status in {"borderline", "appendix_grade"} and "move_to_appendix" not in transforms:
            transforms.append("move_to_appendix")
        plan[figure.figure_id] = transforms
    return plan


def _parse_manifest(payload: dict) -> FigureManifest:
    if not isinstance(payload, dict):
        raise FigureManifestError("Manifest must be a JSON object")

    version = payload.get("manifestVersion")
    if not isinstance(version, int):
        raise FigureManifestError("manifestVersion must be an integer")
    created_at = payload.get("createdAt")
    if not isinstance(created_at, str):
        raise FigureManifestError("createdAt must be a string")
    contract_ref = payload.get("contractRef")
    if not isinstance(contract_ref, dict):
        raise FigureManifestError("contractRef must be an object")
    contract_path = contract_ref.get("contractPath")
    contract_hash = contract_ref.get("contractHash")
    if not isinstance(contract_path, str) or not contract_path:
        raise FigureManifestError("contractRef.contractPath must be a non-empty string")
    if not isinstance(contract_hash, str) or not contract_hash:
        raise FigureManifestError("contractRef.contractHash must be a non-empty string")

    figures_raw = payload.get("figures")
    if not isinstance(figures_raw, list):
        raise FigureManifestError("figures must be a list")

    seen_ids: set[str] = set()
    figures: list[FigureSpec] = []
    for row in figures_raw:
        figure = _parse_figure(row)
        if figure.figure_id in seen_ids:
            raise FigureManifestError(f"Duplicate figureId: {figure.figure_id}")
        seen_ids.add(figure.figure_id)
        figures.append(figure)

    return FigureManifest(
        manifest_version=version,
        created_at=created_at,
        contract_path=contract_path,
        contract_hash=contract_hash,
        figures=tuple(figures),
    )


def _parse_figure(payload: dict) -> FigureSpec:
    if not isinstance(payload, dict):
        raise FigureManifestError("Each figure entry must be an object")
    figure_id = payload.get("figureId")
    tier = payload.get("tier")
    figure_path = payload.get("path")
    purpose = payload.get("purpose")
    inputs = payload.get("inputs")

    if not isinstance(figure_id, str) or not figure_id:
        raise FigureManifestError("figureId must be a non-empty string")
    if tier not in ALLOWED_TIERS:
        raise FigureManifestError(f"Invalid tier `{tier}` for figure `{figure_id}`")
    if not isinstance(figure_path, str) or not figure_path:
        raise FigureManifestError(f"path must be a non-empty string for figure `{figure_id}`")
    if not isinstance(purpose, str) or not purpose:
        raise FigureManifestError(f"purpose must be a non-empty string for figure `{figure_id}`")
    if not isinstance(inputs, list) or any(not isinstance(value, str) for value in inputs):
        raise FigureManifestError(f"inputs must be a string list for figure `{figure_id}`")

    readability_raw = payload.get("readability")
    readability = _parse_readability(readability_raw, figure_id)
    return FigureSpec(
        figure_id=figure_id,
        tier=tier,
        path=figure_path,
        purpose=purpose,
        inputs=tuple(inputs),
        readability=readability,
    )


def _parse_readability(payload: dict, figure_id: str) -> ReadabilitySpec:
    if not isinstance(payload, dict):
        raise FigureManifestError(f"readability must be an object for figure `{figure_id}`")
    status = payload.get("status")
    known_issues = payload.get("knownIssues")
    repair_transforms = payload.get("repairTransforms")

    if status not in ALLOWED_READABILITY_STATUSES:
        raise FigureManifestError(f"Invalid readability.status `{status}` for figure `{figure_id}`")
    if not isinstance(known_issues, list) or any(not isinstance(value, str) for value in known_issues):
        raise FigureManifestError(f"knownIssues must be a string list for figure `{figure_id}`")
    if not isinstance(repair_transforms, list) or any(not isinstance(value, str) for value in repair_transforms):
        raise FigureManifestError(f"repairTransforms must be a string list for figure `{figure_id}`")
    return ReadabilitySpec(
        status=status,
        known_issues=tuple(known_issues),
        repair_transforms=tuple(repair_transforms),
    )


def _validate_figure_paths(manifest: FigureManifest, repo_root: Path) -> None:
    for figure in manifest.figures:
        if not (repo_root / figure.path).exists():
            raise FigureManifestError(f"Figure path does not exist: {figure.path}")

