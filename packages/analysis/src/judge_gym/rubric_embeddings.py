from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from functools import lru_cache
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

from .datasets import SnapshotBundle

DEFAULT_RUBRIC_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def default_embedding_cache_path() -> Path:
    return Path(__file__).resolve().parents[2] / "_cache" / "rubric_embedding_cache.sqlite"


def default_model_cache_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "_cache" / "hf_models"


def connect_embedding_cache(path: str | Path | None = None) -> sqlite3.Connection:
    db_path = Path(path) if path is not None else default_embedding_cache_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS rubric_embedding_cache (
          model_name TEXT NOT NULL,
          text_hash TEXT NOT NULL,
          text TEXT NOT NULL,
          vector_json TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL,
          PRIMARY KEY (model_name, text_hash)
        )
        """
    )
    connection.commit()
    return connection


def build_rubric_embedding_tables(
    bundle: SnapshotBundle,
    *,
    model_name: str = DEFAULT_RUBRIC_EMBEDDING_MODEL,
    encoder: Callable[[list[str]], np.ndarray] | None = None,
    cache_path: str | Path | None = None,
) -> dict[str, pd.DataFrame]:
    full = _build_full_rubric_records(bundle)
    stage = _build_stage_rubric_records(bundle)
    criterion = _build_criterion_rubric_records(bundle)
    if full.empty:
        return {
            "full": full,
            "stage": stage,
            "criterion": criterion,
        }

    full = attach_embedding_vectors(
        full,
        text_column="rubric_text",
        model_name=model_name,
        encoder=encoder,
        cache_path=cache_path,
    )
    stage = attach_embedding_vectors(
        stage,
        text_column="stage_text",
        model_name=model_name,
        encoder=encoder,
        cache_path=cache_path,
    )
    criterion = attach_embedding_vectors(
        criterion,
        text_column="criterion_text",
        model_name=model_name,
        encoder=encoder,
        cache_path=cache_path,
    )
    return {
        "full": full,
        "stage": stage,
        "criterion": criterion,
    }


def attach_embedding_vectors(
    frame: pd.DataFrame,
    *,
    text_column: str,
    model_name: str,
    encoder: Callable[[list[str]], np.ndarray] | None = None,
    cache_path: str | Path | None = None,
) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()
    texts = frame[text_column].astype(str).tolist()
    vectors = embed_texts(
        texts,
        model_name=model_name,
        encoder=encoder,
        cache_path=cache_path,
    )
    enriched = frame.copy()
    enriched["embedding_model"] = model_name
    enriched["vector_json"] = [json.dumps(vector.tolist()) for vector in vectors]
    return enriched


def embed_texts(
    texts: list[str],
    *,
    model_name: str,
    encoder: Callable[[list[str]], np.ndarray] | None = None,
    cache_path: str | Path | None = None,
) -> np.ndarray:
    if not texts:
        return np.zeros((0, 0), dtype=float)
    encode = encoder or _sentence_transformer_encoder(model_name)
    text_hashes = [_text_hash(text) for text in texts]
    cached_vectors = _load_cached_vectors(model_name=model_name, text_hashes=text_hashes, cache_path=cache_path)
    missing = [text for text, text_hash in zip(texts, text_hashes, strict=False) if text_hash not in cached_vectors]
    if missing:
        vectors = encode(missing)
        _store_cached_vectors(
            model_name=model_name,
            texts=missing,
            vectors=vectors,
            cache_path=cache_path,
        )
        cached_vectors.update({
            _text_hash(text): vector
            for text, vector in zip(missing, vectors, strict=False)
        })
    return np.vstack([cached_vectors[text_hash] for text_hash in text_hashes])


def vector_from_json(value: str) -> np.ndarray:
    return np.array(json.loads(value), dtype=float)


def _build_full_rubric_records(bundle: SnapshotBundle) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for row in bundle.rubrics.itertuples():
        rows.append(
            {
                "experiment_tag": row.experiment_tag,
                "sample_ordinal": int(row.sample_ordinal),
                "rubric_id": row.rubric_id,
                "rubric_text": _render_full_rubric_text(row.concept, row.stages),
            }
        )
    return pd.DataFrame(rows).sort_values(["experiment_tag", "sample_ordinal"]).reset_index(drop=True)


def _build_stage_rubric_records(bundle: SnapshotBundle) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for row in bundle.rubrics.itertuples():
        for stage in row.stages:
            rows.append(
                {
                    "experiment_tag": row.experiment_tag,
                    "sample_ordinal": int(row.sample_ordinal),
                    "rubric_id": row.rubric_id,
                    "stage_number": int(stage.get("stage_number", 0)),
                    "stage_label": str(stage.get("label", "")),
                    "stage_text": _render_stage_text(stage),
                }
            )
    return pd.DataFrame(rows).sort_values(
        ["experiment_tag", "sample_ordinal", "stage_number"],
    ).reset_index(drop=True)


def _build_criterion_rubric_records(bundle: SnapshotBundle) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for row in bundle.rubrics.itertuples():
        for stage in row.stages:
            criteria = stage.get("criteria", [])
            if not isinstance(criteria, list):
                continue
            for criterion_ordinal, criterion in enumerate(criteria, start=1):
                rows.append(
                    {
                        "experiment_tag": row.experiment_tag,
                        "sample_ordinal": int(row.sample_ordinal),
                        "rubric_id": row.rubric_id,
                        "stage_number": int(stage.get("stage_number", 0)),
                        "criterion_ordinal": criterion_ordinal,
                        "criterion_text": str(criterion),
                    }
                )
    return pd.DataFrame(rows).sort_values(
        ["experiment_tag", "sample_ordinal", "stage_number", "criterion_ordinal"],
    ).reset_index(drop=True)


def _render_full_rubric_text(concept: str, stages: list[dict]) -> str:
    parts = [f"Concept: {concept}"]
    for stage in stages:
        parts.append(_render_stage_text(stage))
    return "\n".join(parts)


def _render_stage_text(stage: dict) -> str:
    criteria = stage.get("criteria", [])
    if isinstance(criteria, list):
        criteria_text = " ".join(str(item) for item in criteria)
    else:
        criteria_text = str(criteria)
    return (
        f"Stage {stage.get('stage_number', '')}: "
        f"{stage.get('label', '')}. {criteria_text}"
    ).strip()


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _load_cached_vectors(
    *,
    model_name: str,
    text_hashes: list[str],
    cache_path: str | Path | None,
) -> dict[str, np.ndarray]:
    if not text_hashes:
        return {}
    placeholders = ", ".join(["?"] * len(text_hashes))
    connection = connect_embedding_cache(cache_path)
    try:
        rows = connection.execute(
            f"""
            SELECT text_hash, vector_json
            FROM rubric_embedding_cache
            WHERE model_name = ?
              AND text_hash IN ({placeholders})
            """,
            [model_name, *text_hashes],
        ).fetchall()
    finally:
        connection.close()
    return {
        str(row["text_hash"]): vector_from_json(str(row["vector_json"]))
        for row in rows
    }


def _store_cached_vectors(
    *,
    model_name: str,
    texts: list[str],
    vectors: np.ndarray,
    cache_path: str | Path | None,
) -> None:
    connection = connect_embedding_cache(cache_path)
    try:
        with connection:
            connection.executemany(
                """
                INSERT OR REPLACE INTO rubric_embedding_cache (
                  model_name, text_hash, text, vector_json, created_at_ms
                ) VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        model_name,
                        _text_hash(text),
                        text,
                        json.dumps(vector.tolist()),
                        int(time.time() * 1000),
                    )
                    for text, vector in zip(texts, vectors, strict=False)
                ],
            )
    finally:
        connection.close()


@lru_cache(maxsize=2)
def _load_model(model_name: str):
    from sentence_transformers import SentenceTransformer

    cache_folder = default_model_cache_dir()
    cache_folder.mkdir(parents=True, exist_ok=True)
    return SentenceTransformer(model_name, cache_folder=str(cache_folder), device="cpu")


def _sentence_transformer_encoder(model_name: str) -> Callable[[list[str]], np.ndarray]:
    def encode(texts: list[str]) -> np.ndarray:
        model = _load_model(model_name)
        return np.asarray(
            model.encode(
                texts,
                normalize_embeddings=True,
                show_progress_bar=False,
            ),
            dtype=float,
        )

    return encode
