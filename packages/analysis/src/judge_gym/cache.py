from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Iterable

APPLICATION_ID = 0x4A47414D  # "JGAM"
SCHEMA_VERSION = 1


def default_cache_path() -> Path:
    return Path(__file__).resolve().parents[2] / "_cache" / "analysis.sqlite"


def connect_cache(path: str | Path | None = None) -> sqlite3.Connection:
    db_path = Path(path) if path is not None else default_cache_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute(f"PRAGMA application_id={APPLICATION_ID};")
    connection.execute(f"PRAGMA user_version={SCHEMA_VERSION};")
    ensure_schema(connection)
    return connection


def ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS export_snapshots (
          snapshot_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL,
          deployment_url TEXT NOT NULL,
          experiment_tag TEXT NOT NULL,
          run_id TEXT NOT NULL,
          run_created_at_ms INTEGER NOT NULL,
          export_schema_version INTEGER NOT NULL,
          source_manifest_json TEXT NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshot_identity
          ON export_snapshots (deployment_url, run_id, export_schema_version, status);
        CREATE INDEX IF NOT EXISTS idx_snapshot_experiment
          ON export_snapshots (experiment_tag, created_at_ms DESC);

        CREATE TABLE IF NOT EXISTS analysis_responses (
          snapshot_id TEXT NOT NULL,
          response_id TEXT NOT NULL,
          experiment_id TEXT NOT NULL,
          experiment_tag TEXT NOT NULL,
          run_id TEXT NOT NULL,
          sample_id TEXT NOT NULL,
          sample_ordinal INTEGER NOT NULL,
          score_target_id TEXT NOT NULL,
          score_critic_id TEXT,
          rubric_id TEXT,
          rubric_critic_id TEXT,
          model TEXT NOT NULL,
          concept TEXT NOT NULL,
          scale_size INTEGER NOT NULL,
          scoring_method TEXT NOT NULL,
          abstain_enabled INTEGER NOT NULL,
          evidence_view TEXT NOT NULL,
          evidence_bundle_size INTEGER NOT NULL,
          randomizations_json TEXT NOT NULL,
          decoded_scores_json TEXT NOT NULL,
          abstained INTEGER NOT NULL,
          subset_size INTEGER NOT NULL,
          justification TEXT NOT NULL,
          score_expert_agreement_prob REAL,
          rubric_observability_score REAL,
          rubric_discriminability_score REAL,
          evidence_ids_json TEXT NOT NULL,
          evidence_labels_json TEXT NOT NULL,
          evidence_titles_json TEXT NOT NULL,
          evidence_urls_json TEXT NOT NULL,
          window_ids_json TEXT NOT NULL,
          evidence_positions_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_analysis_responses_snapshot
          ON analysis_responses (snapshot_id, experiment_tag);

        CREATE TABLE IF NOT EXISTS analysis_rubrics (
          snapshot_id TEXT NOT NULL,
          rubric_id TEXT NOT NULL,
          experiment_id TEXT NOT NULL,
          experiment_tag TEXT NOT NULL,
          run_id TEXT NOT NULL,
          sample_id TEXT NOT NULL,
          sample_ordinal INTEGER NOT NULL,
          model TEXT NOT NULL,
          concept TEXT NOT NULL,
          scale_size INTEGER NOT NULL,
          stages_json TEXT NOT NULL,
          label_mapping_json TEXT NOT NULL,
          justification TEXT NOT NULL,
          observability_score REAL,
          discriminability_score REAL
        );
        CREATE INDEX IF NOT EXISTS idx_analysis_rubrics_snapshot
          ON analysis_rubrics (snapshot_id, experiment_tag);

        CREATE TABLE IF NOT EXISTS analysis_evidence (
          snapshot_id TEXT NOT NULL,
          evidence_id TEXT NOT NULL,
          experiment_id TEXT NOT NULL,
          experiment_tag TEXT NOT NULL,
          run_id TEXT NOT NULL,
          pool_tag TEXT,
          label TEXT NOT NULL,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          window_id TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_analysis_evidence_snapshot
          ON analysis_evidence (snapshot_id, experiment_tag);

        CREATE TABLE IF NOT EXISTS analysis_samples (
          snapshot_id TEXT NOT NULL,
          sample_id TEXT NOT NULL,
          experiment_id TEXT NOT NULL,
          experiment_tag TEXT NOT NULL,
          run_id TEXT NOT NULL,
          sample_ordinal INTEGER NOT NULL,
          model TEXT NOT NULL,
          seed INTEGER NOT NULL,
          rubric_id TEXT,
          rubric_critic_id TEXT,
          score_target_total INTEGER NOT NULL,
          score_count INTEGER NOT NULL,
          score_critic_count INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_analysis_samples_snapshot
          ON analysis_samples (snapshot_id, experiment_tag);

        CREATE TABLE IF NOT EXISTS analysis_artifacts (
          snapshot_id TEXT NOT NULL,
          report_name TEXT NOT NULL,
          artifact_kind TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL,
          metadata_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_analysis_artifacts_snapshot
          ON analysis_artifacts (snapshot_id, report_name);
        """
    )
    connection.commit()


def existing_snapshot_id(
    connection: sqlite3.Connection,
    *,
    deployment_url: str,
    run_id: str,
    export_schema_version: int,
) -> str | None:
    row = connection.execute(
        """
        SELECT snapshot_id
        FROM export_snapshots
        WHERE deployment_url = ?
          AND run_id = ?
          AND export_schema_version = ?
          AND status = 'completed'
        ORDER BY created_at_ms DESC
        LIMIT 1
        """,
        (deployment_url, run_id, export_schema_version),
    ).fetchone()
    return None if row is None else str(row["snapshot_id"])


def create_snapshot(
    connection: sqlite3.Connection,
    *,
    deployment_url: str,
    manifest: dict[str, Any],
) -> str:
    snapshot_id = uuid.uuid4().hex
    connection.execute(
        """
        INSERT INTO export_snapshots (
          snapshot_id,
          status,
          created_at_ms,
          deployment_url,
          experiment_tag,
          run_id,
          run_created_at_ms,
          export_schema_version,
          source_manifest_json
        ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            snapshot_id,
            int(time.time() * 1000),
            deployment_url,
            manifest["experiment"]["experiment_tag"],
            manifest["run"]["run_id"],
            int(manifest["run"]["created_at"]),
            int(manifest["export_schema_version"]),
            json.dumps(manifest, sort_keys=True),
        ),
    )
    connection.commit()
    return snapshot_id


def mark_snapshot_completed(connection: sqlite3.Connection, snapshot_id: str) -> None:
    connection.execute(
        "UPDATE export_snapshots SET status = 'completed' WHERE snapshot_id = ?",
        (snapshot_id,),
    )
    connection.commit()


def write_snapshot_dataset(
    connection: sqlite3.Connection,
    *,
    snapshot_id: str,
    table: str,
    rows: Iterable[dict[str, Any]],
) -> None:
    row_list = list(rows)
    if not row_list:
        return

    serialized = [_serialize_row(snapshot_id, table, row) for row in row_list]
    columns = list(serialized[0].keys())
    placeholders = ", ".join(["?"] * len(columns))
    column_sql = ", ".join(columns)
    values = [tuple(item[column] for column in columns) for item in serialized]
    with connection:
        connection.executemany(
            f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders})",
            values,
        )


def list_latest_snapshot_ids(
    connection: sqlite3.Connection,
    experiment_tags: list[str],
) -> list[str]:
    snapshot_ids: list[str] = []
    for tag in experiment_tags:
        row = connection.execute(
            """
            SELECT snapshot_id
            FROM export_snapshots
            WHERE experiment_tag = ?
              AND status = 'completed'
            ORDER BY created_at_ms DESC
            LIMIT 1
            """,
            (tag,),
        ).fetchone()
        if row is None:
            raise ValueError(f"No completed snapshot cached for experiment_tag={tag}")
        snapshot_ids.append(str(row["snapshot_id"]))
    return snapshot_ids


def list_completed_experiment_tags(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute(
        """
        SELECT DISTINCT experiment_tag
        FROM export_snapshots
        WHERE status = 'completed'
        ORDER BY experiment_tag
        """
    ).fetchall()
    return [str(row["experiment_tag"]) for row in rows]


def record_artifact(
    connection: sqlite3.Connection,
    *,
    snapshot_id: str,
    report_name: str,
    artifact_kind: str,
    path: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO analysis_artifacts (
          snapshot_id, report_name, artifact_kind, path, created_at_ms, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            snapshot_id,
            report_name,
            artifact_kind,
            path,
            int(time.time() * 1000),
            json.dumps(metadata or {}, sort_keys=True),
        ),
    )
    connection.commit()


def snapshot_manifest(
    connection: sqlite3.Connection,
    snapshot_id: str,
) -> dict[str, Any]:
    row = connection.execute(
        "SELECT source_manifest_json FROM export_snapshots WHERE snapshot_id = ?",
        (snapshot_id,),
    ).fetchone()
    if row is None:
        raise ValueError(f"Unknown snapshot_id={snapshot_id}")
    return json.loads(str(row["source_manifest_json"]))


def _serialize_row(
    snapshot_id: str,
    table: str,
    row: dict[str, Any],
) -> dict[str, Any]:
    base = {"snapshot_id": snapshot_id}
    if table == "analysis_responses":
        return base | {
            "response_id": row["response_id"],
            "experiment_id": row["experiment_id"],
            "experiment_tag": row["experiment_tag"],
            "run_id": row["run_id"],
            "sample_id": row["sample_id"],
            "sample_ordinal": row["sample_ordinal"],
            "score_target_id": row["score_target_id"],
            "score_critic_id": row["score_critic_id"],
            "rubric_id": row["rubric_id"],
            "rubric_critic_id": row["rubric_critic_id"],
            "model": row["model"],
            "concept": row["concept"],
            "scale_size": row["scale_size"],
            "scoring_method": row["scoring_method"],
            "abstain_enabled": int(bool(row["abstain_enabled"])),
            "evidence_view": row["evidence_view"],
            "evidence_bundle_size": row["evidence_bundle_size"],
            "randomizations_json": json.dumps(row["randomizations"]),
            "decoded_scores_json": json.dumps(row["decoded_scores"]),
            "abstained": int(bool(row["abstained"])),
            "subset_size": row["subset_size"],
            "justification": row["justification"],
            "score_expert_agreement_prob": row["score_expert_agreement_prob"],
            "rubric_observability_score": row["rubric_observability_score"],
            "rubric_discriminability_score": row["rubric_discriminability_score"],
            "evidence_ids_json": json.dumps(row["evidence_ids"]),
            "evidence_labels_json": json.dumps(row["evidence_labels"]),
            "evidence_titles_json": json.dumps(row["evidence_titles"]),
            "evidence_urls_json": json.dumps(row["evidence_urls"]),
            "window_ids_json": json.dumps(row["window_ids"]),
            "evidence_positions_json": json.dumps(row["evidence_positions"]),
        }
    if table == "analysis_rubrics":
        return base | {
            "rubric_id": row["rubric_id"],
            "experiment_id": row["experiment_id"],
            "experiment_tag": row["experiment_tag"],
            "run_id": row["run_id"],
            "sample_id": row["sample_id"],
            "sample_ordinal": row["sample_ordinal"],
            "model": row["model"],
            "concept": row["concept"],
            "scale_size": row["scale_size"],
            "stages_json": json.dumps(row["stages"]),
            "label_mapping_json": json.dumps(row["label_mapping"]),
            "justification": row["justification"],
            "observability_score": row["observability_score"],
            "discriminability_score": row["discriminability_score"],
        }
    if table == "analysis_evidence":
        return base | {
            "evidence_id": row["evidence_id"],
            "experiment_id": row["experiment_id"],
            "experiment_tag": row["experiment_tag"],
            "run_id": row["run_id"],
            "pool_tag": row["pool_tag"],
            "label": row["label"],
            "title": row["title"],
            "url": row["url"],
            "window_id": row["window_id"],
        }
    if table == "analysis_samples":
        return base | {
            "sample_id": row["sample_id"],
            "experiment_id": row["experiment_id"],
            "experiment_tag": row["experiment_tag"],
            "run_id": row["run_id"],
            "sample_ordinal": row["sample_ordinal"],
            "model": row["model"],
            "seed": row["seed"],
            "rubric_id": row["rubric_id"],
            "rubric_critic_id": row["rubric_critic_id"],
            "score_target_total": row["score_target_total"],
            "score_count": row["score_count"],
            "score_critic_count": row["score_critic_count"],
        }
    raise ValueError(f"Unsupported table={table}")
