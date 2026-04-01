from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Any

import httpx

from .cache import (
    connect_cache,
    create_snapshot,
    delete_snapshots,
    existing_snapshot_id,
    mark_snapshot_completed,
    write_snapshot_dataset,
)


@dataclass
class ExportedSnapshot:
    snapshot_id: str
    experiment_tag: str
    run_id: str
    manifest: dict[str, Any]


@dataclass(frozen=True)
class ExportTarget:
    experiment_tag: str | None = None
    run_id: str | None = None


class ConvexAnalysisClient:
    def __init__(self, deployment_url: str, *, transport: httpx.BaseTransport | None = None):
        self.deployment_url = deployment_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.deployment_url,
            timeout=60.0,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def query(self, function_name: str, args: dict[str, Any]) -> Any:
        retries = 3
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                response = self._client.post(
                    "/api/query",
                    json={"path": function_name, "args": args},
                )
                response.raise_for_status()
                return response.json()["value"]
            except httpx.HTTPStatusError as error:
                if error.response.status_code not in {502, 503, 504} or attempt >= retries:
                    raise
                last_error = error
            except httpx.HTTPError as error:
                if attempt >= retries:
                    raise
                last_error = error
            time.sleep(1.5 * (attempt + 1))
        if last_error is not None:
            raise last_error
        raise RuntimeError("Unreachable query retry state")

    def list_experiments(self) -> list[dict[str, Any]]:
        return list(self.query("packages/analysis:listAnalysisExperiments", {}))

    def get_manifest(
        self,
        *,
        experiment_tag: str | None = None,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        args: dict[str, Any] = {}
        if experiment_tag is not None:
            args["experiment_tag"] = experiment_tag
        if run_id is not None:
            args["run_id"] = run_id
        return dict(self.query("packages/analysis:getAnalysisManifest", args))

    def collect_dataset(
        self,
        function_name: str,
        *,
        run_id: str,
        page_size: int,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        cursor: str | None = None
        current_page_size = page_size
        while True:
            try:
                payload = self.query(
                    function_name,
                    {"run_id": run_id, "pagination": {"limit": current_page_size, "cursor": cursor}},
                )
            except httpx.HTTPStatusError as error:
                if error.response.status_code not in {500, 502, 503, 504} or current_page_size <= 10:
                    raise
                current_page_size = max(10, current_page_size // 2)
                continue
            except httpx.HTTPError:
                if current_page_size <= 10:
                    raise
                current_page_size = max(10, current_page_size // 2)
                continue
            rows.extend(payload["page"])
            if payload["is_done"]:
                break
            cursor = payload["continue_cursor"]
        return rows


def build_response_items(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    item_rows: list[dict[str, Any]] = []
    for row in rows:
        evidence_set_item_ids = list(row.get("evidence_set_item_ids", []))
        evidence_item_ids = list(row.get("evidence_item_ids", []))
        evidence_view_ids = list(row.get("evidence_view_ids", []))
        evidence_labels = list(row.get("evidence_labels", []))
        evidence_titles = list(row.get("evidence_titles", []))
        evidence_urls = list(row.get("evidence_urls", []))
        positions = list(row.get("evidence_positions", []))
        bundle_size = len(evidence_item_ids)
        for index, evidence_item_id in enumerate(evidence_item_ids):
            item_rows.append({
                "response_id": row["response_id"],
                "experiment_tag": row["experiment_tag"],
                "run_id": row["run_id"],
                "sample_id": row["sample_id"],
                "sample_ordinal": row["sample_ordinal"],
                "score_target_id": row["score_target_id"],
                "bundle_plan_tag": row.get("bundle_plan_tag"),
                "bundle_strategy": row.get("bundle_strategy"),
                "bundle_signature": row.get("bundle_signature") or "",
                "cluster_id": row.get("cluster_id"),
                "bundle_size": bundle_size,
                "abstained": row["abstained"],
                "subset_size": row["subset_size"],
                "evidence_set_item_id": evidence_set_item_ids[index] if index < len(evidence_set_item_ids) else "",
                "evidence_item_id": evidence_item_id,
                "evidence_view_id": evidence_view_ids[index] if index < len(evidence_view_ids) else None,
                "evidence_label": evidence_labels[index] if index < len(evidence_labels) else "",
                "evidence_title": evidence_titles[index] if index < len(evidence_titles) else "",
                "evidence_url": evidence_urls[index] if index < len(evidence_urls) else "",
                "position": positions[index] if index < len(positions) else index,
            })
    return item_rows


def _export_targets(
    *,
    targets: list[ExportTarget],
    deployment_url: str,
    cache_db_path: str | None = None,
    refresh: bool = False,
    page_size: int = 200,
    transport: httpx.BaseTransport | None = None,
) -> list[ExportedSnapshot]:
    connection = connect_cache(cache_db_path)
    client = ConvexAnalysisClient(deployment_url, transport=transport)
    snapshots: list[ExportedSnapshot] = []

    try:
        for target in targets:
            manifest = client.get_manifest(
                experiment_tag=target.experiment_tag,
                run_id=target.run_id,
            )
            experiment_tag = str(manifest["experiment"]["experiment_tag"])
            run_id = str(manifest["run"]["run_id"])
            schema_version = int(manifest["export_schema_version"])
            if not refresh:
                cached = existing_snapshot_id(
                    connection,
                    deployment_url=deployment_url,
                    run_id=run_id,
                    export_schema_version=schema_version,
                )
                if cached is not None:
                    snapshots.append(
                        ExportedSnapshot(
                            snapshot_id=cached,
                            experiment_tag=experiment_tag,
                            run_id=run_id,
                            manifest=manifest,
                        )
                    )
                    continue
            else:
                delete_snapshots(
                    connection,
                    deployment_url=deployment_url,
                    run_id=run_id,
                    export_schema_version=schema_version,
                )

            snapshot_id = create_snapshot(
                connection,
                deployment_url=deployment_url,
                manifest=manifest,
            )
            dataset_map = {
                "analysis_responses": "packages/analysis:listAnalysisResponses",
                "analysis_rubrics": "packages/analysis:listAnalysisRubrics",
                "analysis_evidence": "packages/analysis:listAnalysisEvidence",
                "analysis_samples": "packages/analysis:listAnalysisSamples",
            }

            datasets: dict[str, list[dict[str, Any]]] = {}
            for table, function_name in dataset_map.items():
                rows = client.collect_dataset(
                    function_name,
                    run_id=run_id,
                    page_size=page_size,
                )
                datasets[table] = rows
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table=table,
                    rows=rows,
                )
            write_snapshot_dataset(
                connection,
                snapshot_id=snapshot_id,
                table="analysis_response_items",
                rows=build_response_items(datasets["analysis_responses"]),
            )

            mark_snapshot_completed(connection, snapshot_id)
            snapshots.append(
                ExportedSnapshot(
                    snapshot_id=snapshot_id,
                    experiment_tag=experiment_tag,
                    run_id=run_id,
                    manifest=manifest,
                )
            )
    finally:
        client.close()
        connection.close()

    return snapshots


def export_experiments(
    *,
    experiment_tags: list[str],
    deployment_url: str,
    cache_db_path: str | None = None,
    refresh: bool = False,
    page_size: int = 200,
    transport: httpx.BaseTransport | None = None,
) -> list[ExportedSnapshot]:
    return _export_targets(
        targets=[ExportTarget(experiment_tag=experiment_tag) for experiment_tag in experiment_tags],
        deployment_url=deployment_url,
        cache_db_path=cache_db_path,
        refresh=refresh,
        page_size=page_size,
        transport=transport,
    )


def export_runs(
    *,
    run_ids: list[str],
    deployment_url: str,
    cache_db_path: str | None = None,
    refresh: bool = False,
    page_size: int = 200,
    transport: httpx.BaseTransport | None = None,
) -> list[ExportedSnapshot]:
    return _export_targets(
        targets=[ExportTarget(run_id=run_id) for run_id in run_ids],
        deployment_url=deployment_url,
        cache_db_path=cache_db_path,
        refresh=refresh,
        page_size=page_size,
        transport=transport,
    )
