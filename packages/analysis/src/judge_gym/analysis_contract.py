from __future__ import annotations

import hashlib
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .contracts import load_json, resolve_repo_path


class ContractValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ContrastDefinition:
    contrast_id: str
    family_slug: str
    contrast_kind: str
    baseline_tag: str
    variant_tag: str
    matching_keys: tuple[str, ...]
    mode: str
    fully_matched: bool
    payload: dict[str, Any]


@dataclass(frozen=True)
class ContrastRegistry:
    version: str
    contrasts: tuple[ContrastDefinition, ...]
    payload: dict[str, Any]


@dataclass(frozen=True)
class AnalysisContract:
    path: Path
    payload: dict[str, Any]

    @property
    def export_schema_version(self) -> int:
        return int(self.payload["dataSource"]["exportSchemaVersion"])

    @property
    def sqlite_path(self) -> str:
        return str(self.payload["dataSource"]["sqlitePath"])

    @property
    def snapshot_ids(self) -> list[str]:
        return [str(value) for value in self.payload["dataSource"]["snapshotIds"]]

    @property
    def include_tags(self) -> list[str]:
        return [str(value) for value in self.payload["inclusion"]["includeTags"]]

    @property
    def exclude_tags(self) -> list[str]:
        return [str(value) for value in self.payload["inclusion"]["excludeTags"]]

    @property
    def resolved_include_tags(self) -> list[str]:
        excludes = set(self.exclude_tags)
        return [tag for tag in self.include_tags if tag not in excludes]

    @property
    def contrast_registry_path(self) -> str:
        return str(self.payload["contrastRegistry"]["path"])

    @property
    def contrast_count(self) -> int:
        return int(self.payload["contrastRegistry"]["contrastCount"])


@dataclass(frozen=True)
class ContractArtifacts:
    contract: AnalysisContract
    contrast_registry: ContrastRegistry
    figures_manifest: dict[str, Any]


def default_analysis_contract_path() -> Path:
    return resolve_repo_path("_blueprints/v3-analysis-process/analysis_contract.json")


def default_figures_manifest_path() -> Path:
    return resolve_repo_path("_blueprints/v3-analysis-process/figures_manifest.json")


def load_analysis_contract(path: str | Path | None = None) -> AnalysisContract:
    resolved = default_analysis_contract_path() if path is None else resolve_repo_path(path)
    payload = load_json(resolved)
    contract = AnalysisContract(path=resolved, payload=payload)
    _validate_contract(contract)
    return contract


def load_contrast_registry(
    contract: AnalysisContract,
    path: str | Path | None = None,
) -> ContrastRegistry:
    resolved = resolve_repo_path(path) if path is not None else resolve_repo_path(contract.contrast_registry_path)
    payload = load_json(resolved)
    contrasts_payload = payload.get("contrasts")
    if not isinstance(contrasts_payload, list):
        raise ContractValidationError("contrast registry is missing `contrasts` list")
    contrasts: list[ContrastDefinition] = []
    for row in contrasts_payload:
        if not isinstance(row, dict):
            raise ContractValidationError("contrast entries must be JSON objects")
        contrast = ContrastDefinition(
            contrast_id=str(row["contrastId"]),
            family_slug=str(row["familySlug"]),
            contrast_kind=str(row["contrastKind"]),
            baseline_tag=str(row["baselineTag"]),
            variant_tag=str(row["variantTag"]),
            matching_keys=tuple(str(key) for key in row.get("matchingKeys", [])),
            mode=str(row.get("mode", "inferential")),
            fully_matched=bool(row.get("fullyMatched", False)),
            payload=row,
        )
        contrasts.append(contrast)
    registry = ContrastRegistry(
        version=str(payload.get("registryVersion", "")),
        contrasts=tuple(contrasts),
        payload=payload,
    )
    _validate_contrast_registry(contract, registry)
    return registry


def load_figures_manifest(path: str | Path | None = None) -> dict[str, Any]:
    resolved = default_figures_manifest_path() if path is None else resolve_repo_path(path)
    payload = load_json(resolved)
    figures = payload.get("figures")
    if not isinstance(figures, list):
        raise ContractValidationError("figures manifest is missing `figures` list")
    return payload


def load_contract_artifacts(
    *,
    contract_path: str | Path | None = None,
    contrast_registry_path: str | Path | None = None,
    figures_manifest_path: str | Path | None = None,
) -> ContractArtifacts:
    contract = load_analysis_contract(contract_path)
    registry = load_contrast_registry(contract, contrast_registry_path)
    figures_manifest = load_figures_manifest(figures_manifest_path)
    _validate_manifest_contract_link(contract, figures_manifest)
    return ContractArtifacts(
        contract=contract,
        contrast_registry=registry,
        figures_manifest=figures_manifest,
    )


def validate_contract_against_cache(
    connection: sqlite3.Connection,
    contract: AnalysisContract,
    contrast_registry: ContrastRegistry,
) -> None:
    if not contract.snapshot_ids:
        raise ContractValidationError("contract must include at least one snapshot id")
    placeholders = ", ".join(["?"] * len(contract.snapshot_ids))
    rows = connection.execute(
        f"""
        SELECT snapshot_id, status, experiment_tag, export_schema_version
        FROM export_snapshots
        WHERE snapshot_id IN ({placeholders})
        """,
        contract.snapshot_ids,
    ).fetchall()
    if len(rows) != len(contract.snapshot_ids):
        found = {str(row["snapshot_id"]) for row in rows}
        missing = sorted(set(contract.snapshot_ids) - found)
        raise ContractValidationError(f"cache is missing contract snapshots: {missing}")

    tags_in_cache = {str(row["experiment_tag"]) for row in rows}
    statuses = {str(row["status"]) for row in rows}
    schema_versions = {int(row["export_schema_version"]) for row in rows}
    if statuses != {"completed"}:
        raise ContractValidationError(
            f"contract snapshots must all be completed; found statuses={sorted(statuses)}",
        )
    if schema_versions != {contract.export_schema_version}:
        raise ContractValidationError(
            "contract export schema drift: "
            f"expected {contract.export_schema_version}, found {sorted(schema_versions)}",
        )

    include_tags = set(contract.resolved_include_tags)
    exclude_tags = set(contract.exclude_tags)
    if tags_in_cache != include_tags:
        raise ContractValidationError(
            "contract includeTags drift: "
            f"expected={sorted(include_tags)} found={sorted(tags_in_cache)}",
        )
    overlap = tags_in_cache & exclude_tags
    if overlap:
        raise ContractValidationError(
            f"excluded experiment tags appear in frozen snapshots: {sorted(overlap)}",
        )

    contrast_tags = {
        contrast.baseline_tag
        for contrast in contrast_registry.contrasts
    } | {
        contrast.variant_tag
        for contrast in contrast_registry.contrasts
    }
    if not contrast_tags.issubset(include_tags):
        missing = sorted(contrast_tags - include_tags)
        raise ContractValidationError(f"contrast registry references tags outside include set: {missing}")


def _validate_contract(contract: AnalysisContract) -> None:
    include = contract.include_tags
    exclude = contract.exclude_tags
    if not include:
        raise ContractValidationError("contract inclusion.includeTags must not be empty")
    overlap = set(include) & set(exclude)
    if overlap:
        raise ContractValidationError(
            f"contract include/exclude overlap detected: {sorted(overlap)}",
        )
    if len(set(include)) != len(include):
        raise ContractValidationError("contract includeTags contains duplicates")
    snapshots = contract.snapshot_ids
    if not snapshots:
        raise ContractValidationError("contract dataSource.snapshotIds must not be empty")
    if len(set(snapshots)) != len(snapshots):
        raise ContractValidationError("contract dataSource.snapshotIds contains duplicates")
    if len(snapshots) != len(contract.resolved_include_tags):
        raise ContractValidationError(
            "contract snapshotIds count must match resolved include tag count "
            f"(snapshots={len(snapshots)} include={len(contract.resolved_include_tags)})",
        )


def _validate_contrast_registry(
    contract: AnalysisContract,
    registry: ContrastRegistry,
) -> None:
    if len(registry.contrasts) != contract.contrast_count:
        raise ContractValidationError(
            "contrast registry count drift: "
            f"contract expects {contract.contrast_count}, found {len(registry.contrasts)}",
        )
    include_tags = set(contract.resolved_include_tags)
    for contrast in registry.contrasts:
        if contrast.baseline_tag not in include_tags or contrast.variant_tag not in include_tags:
            raise ContractValidationError(
                "contrast registry includes tag outside include set: "
                f"{contrast.contrast_id}",
            )


def _validate_manifest_contract_link(
    contract: AnalysisContract,
    figures_manifest: dict[str, Any],
) -> None:
    contract_ref = figures_manifest.get("contractRef")
    if not isinstance(contract_ref, dict):
        raise ContractValidationError("figures manifest missing contractRef")
    expected_hash = contract_ref.get("contractHash")
    if isinstance(expected_hash, str) and expected_hash and not expected_hash.startswith("REPLACE_"):
        actual_hash = hashlib.sha256(contract.path.read_bytes()).hexdigest()
        if expected_hash != actual_hash:
            raise ContractValidationError(
                "figures manifest contract hash mismatch: "
                f"expected={expected_hash} actual={actual_hash}",
            )

