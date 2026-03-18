from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from .cache import (
    connect_cache,
    create_snapshot,
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
        response = self._client.post(
            "/api/query",
            json={"path": function_name, "args": args},
        )
        response.raise_for_status()
        return response.json()["value"]

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
        while True:
            payload = self.query(
                function_name,
                {"run_id": run_id, "pagination": {"limit": page_size, "cursor": cursor}},
            )
            rows.extend(payload["page"])
            if payload["is_done"]:
                break
            cursor = payload["continue_cursor"]
        return rows


def export_experiments(
    *,
    experiment_tags: list[str],
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
        for experiment_tag in experiment_tags:
            manifest = client.get_manifest(experiment_tag=experiment_tag)
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

            for table, function_name in dataset_map.items():
                rows = client.collect_dataset(
                    function_name,
                    run_id=run_id,
                    page_size=page_size,
                )
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table=table,
                    rows=rows,
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
