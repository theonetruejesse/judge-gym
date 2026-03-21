from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

import pandas as pd

from .analysis_contract import (
    AnalysisContract,
    ContractArtifacts,
    ContractValidationError,
    load_contract_artifacts,
    validate_contract_against_cache,
)
from .cache import connect_cache, list_latest_snapshot_ids, snapshot_manifest
from .contracts import resolve_repo_path


@dataclass
class SnapshotBundle:
    snapshot_ids: list[str]
    manifests: dict[str, dict[str, Any]]
    responses: pd.DataFrame
    rubrics: pd.DataFrame
    evidence: pd.DataFrame
    samples: pd.DataFrame
    response_items: pd.DataFrame

    @property
    def experiment_tags(self) -> list[str]:
        return [
            self.manifests[snapshot_id]["experiment"]["experiment_tag"]
            for snapshot_id in self.snapshot_ids
        ]

    @property
    def experiments(self) -> dict[str, dict[str, Any]]:
        return {
            manifest["experiment"]["experiment_tag"]: manifest["experiment"]
            for manifest in self.manifests.values()
        }

    @property
    def scale_size(self) -> int:
        if self.responses.empty:
            return 0
        return int(self.responses["scale_size"].dropna().iloc[0])


@dataclass
class ContractSnapshotBundle:
    contract: AnalysisContract
    artifacts: ContractArtifacts
    bundle: SnapshotBundle


def load_snapshot_bundle(
    *,
    snapshot_ids: list[str] | None = None,
    experiment_tags: list[str] | None = None,
    cache_db_path: str | None = None,
) -> SnapshotBundle:
    connection = connect_cache(cache_db_path)
    try:
        resolved_snapshot_ids = list(snapshot_ids or [])
        if not resolved_snapshot_ids:
            if not experiment_tags:
                raise ValueError("Provide snapshot_ids or experiment_tags")
            resolved_snapshot_ids = list_latest_snapshot_ids(connection, experiment_tags)

        manifests = {
            snapshot_id: snapshot_manifest(connection, snapshot_id)
            for snapshot_id in resolved_snapshot_ids
        }
        responses = _decode_response_frame(
            _load_table(connection, "analysis_responses", resolved_snapshot_ids),
        )
        rubrics = _load_table(connection, "analysis_rubrics", resolved_snapshot_ids)
        evidence = _load_table(connection, "analysis_evidence", resolved_snapshot_ids)
        samples = _load_table(connection, "analysis_samples", resolved_snapshot_ids)
        response_items = _load_table(connection, "analysis_response_items", resolved_snapshot_ids)
        if response_items.empty and not responses.empty:
            response_items = _explode_response_items_frame(responses)
        return SnapshotBundle(
            snapshot_ids=resolved_snapshot_ids,
            manifests=manifests,
            responses=responses,
            rubrics=_decode_rubric_frame(rubrics),
            evidence=evidence,
            samples=samples,
            response_items=_decode_response_items_frame(response_items),
        )
    finally:
        connection.close()


def load_snapshot_bundle_for_contract(
    *,
    contract_path: str | None = None,
    contrast_registry_path: str | None = None,
    figures_manifest_path: str | None = None,
    cache_db_path: str | None = None,
    validate_cache: bool = True,
) -> ContractSnapshotBundle:
    artifacts = load_contract_artifacts(
        contract_path=contract_path,
        contrast_registry_path=contrast_registry_path,
        figures_manifest_path=figures_manifest_path,
    )
    contract = artifacts.contract
    resolved_cache = _resolve_cache_path(cache_db_path, contract)
    connection = connect_cache(resolved_cache)
    try:
        if validate_cache:
            validate_contract_against_cache(connection, contract, artifacts.contrast_registry)
    finally:
        connection.close()

    bundle = load_snapshot_bundle(
        snapshot_ids=contract.snapshot_ids,
        cache_db_path=resolved_cache,
    )
    _validate_bundle_against_contract(bundle, contract)
    return ContractSnapshotBundle(
        contract=contract,
        artifacts=artifacts,
        bundle=bundle,
    )


def _load_table(
    connection: sqlite3.Connection,
    table: str,
    snapshot_ids: list[str],
) -> pd.DataFrame:
    placeholders = ", ".join(["?"] * len(snapshot_ids))
    query = f"SELECT * FROM {table} WHERE snapshot_id IN ({placeholders})"
    return pd.read_sql_query(query, connection, params=snapshot_ids)


def _decode_response_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame
    for column in [
        "randomizations_json",
        "decoded_scores_json",
        "evidence_ids_json",
        "evidence_labels_json",
        "evidence_titles_json",
        "evidence_urls_json",
        "window_ids_json",
        "evidence_positions_json",
    ]:
        frame[column] = frame[column].apply(json.loads)

    frame["randomizations"] = frame.pop("randomizations_json")
    frame["decoded_scores"] = frame.pop("decoded_scores_json")
    frame["evidence_ids"] = frame.pop("evidence_ids_json")
    frame["evidence_labels"] = frame.pop("evidence_labels_json")
    frame["evidence_titles"] = frame.pop("evidence_titles_json")
    frame["evidence_urls"] = frame.pop("evidence_urls_json")
    frame["window_ids"] = frame.pop("window_ids_json")
    frame["evidence_positions"] = frame.pop("evidence_positions_json")
    frame["abstain_enabled"] = frame["abstain_enabled"].astype(bool)
    frame["abstained"] = frame["abstained"].astype(bool)
    frame["bundle_label"] = frame["evidence_labels"].apply(lambda vals: " | ".join(vals))
    frame["bundle_size"] = frame["evidence_ids"].apply(len)
    if "bundle_signature" not in frame.columns:
        frame["bundle_signature"] = frame["evidence_ids"].apply(
            lambda vals: "|".join(sorted(str(value) for value in vals)),
        )
    if "cluster_id" not in frame.columns:
        frame["cluster_id"] = None
    return frame


def _decode_rubric_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame
    frame["stages"] = frame.pop("stages_json").apply(json.loads)
    frame["label_mapping"] = frame.pop("label_mapping_json").apply(json.loads)
    return frame


def _decode_response_items_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame
    frame["abstained"] = frame["abstained"].astype(bool)
    return frame


def _explode_response_items_frame(frame: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for row in frame.itertuples():
        bundle_size = len(row.evidence_ids)
        for index, evidence_id in enumerate(row.evidence_ids):
            rows.append(
                {
                    "snapshot_id": row.snapshot_id,
                    "response_id": row.response_id,
                    "experiment_tag": row.experiment_tag,
                    "run_id": row.run_id,
                    "sample_id": row.sample_id,
                    "sample_ordinal": row.sample_ordinal,
                    "score_target_id": row.score_target_id,
                    "bundle_plan_tag": getattr(row, "bundle_plan_tag", None),
                    "bundle_strategy": getattr(row, "bundle_strategy", None),
                    "bundle_signature": getattr(row, "bundle_signature", None)
                    or "|".join(sorted(str(value) for value in row.evidence_ids)),
                    "cluster_id": getattr(row, "cluster_id", None),
                    "bundle_size": bundle_size,
                    "abstained": bool(row.abstained),
                    "subset_size": row.subset_size,
                    "evidence_id": evidence_id,
                    "evidence_label": row.evidence_labels[index] if index < len(row.evidence_labels) else "",
                    "evidence_title": row.evidence_titles[index] if index < len(row.evidence_titles) else "",
                    "evidence_url": row.evidence_urls[index] if index < len(row.evidence_urls) else "",
                    "window_id": row.window_ids[index] if index < len(row.window_ids) else "",
                    "position": row.evidence_positions[index] if index < len(row.evidence_positions) else index,
                }
            )
    return pd.DataFrame(rows)


def _resolve_cache_path(
    cache_db_path: str | None,
    contract: AnalysisContract,
) -> str:
    if cache_db_path is not None:
        return cache_db_path
    return str(resolve_repo_path(contract.sqlite_path))


def _validate_bundle_against_contract(
    bundle: SnapshotBundle,
    contract: AnalysisContract,
) -> None:
    expected_snapshots = set(contract.snapshot_ids)
    found_snapshots = set(bundle.snapshot_ids)
    if found_snapshots != expected_snapshots:
        raise ContractValidationError(
            "loaded snapshot ids drift from contract: "
            f"expected={sorted(expected_snapshots)} found={sorted(found_snapshots)}",
        )

    expected_tags = set(contract.resolved_include_tags)
    found_tags = set(bundle.experiment_tags)
    if found_tags != expected_tags:
        raise ContractValidationError(
            "loaded experiment tags drift from contract include set: "
            f"expected={sorted(expected_tags)} found={sorted(found_tags)}",
        )

    excluded = found_tags & set(contract.exclude_tags)
    if excluded:
        raise ContractValidationError(f"excluded tags found in loaded bundle: {sorted(excluded)}")
