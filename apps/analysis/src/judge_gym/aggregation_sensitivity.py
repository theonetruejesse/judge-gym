from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .aggregation_methods import (
    VerdictObservation,
    aggregate_local_closed_world,
    aggregate_local_tbm,
    geometry_support_summary,
    log_opinion_pool,
    verdict_to_stage_probabilities,
    weighted_linear_opinion_pool,
)
from .analysis_contract import load_analysis_contract, load_contrast_registry
from .contracts import resolve_repo_path
from .datasets import load_snapshot_bundle_for_contract

_SAMPLE_KEYS = ["experiment_tag", "sample_ordinal", "model_id", "scale_size"]
_METHOD_ORDER = [
    "geometry_first",
    "weighted_linear_pool",
    "log_opinion_pool",
    "local_tbm",
    "local_closed_world",
]
_SENSITIVITY_ENDPOINTS = ["expected_stage", "entropy_norm", "top1_prob", "conflict"]


@dataclass(frozen=True)
class AggregationSensitivityOutputs:
    sample_methods: pd.DataFrame
    method_summary: pd.DataFrame
    method_alignment: pd.DataFrame
    contrast_sensitivity: pd.DataFrame
    report_panel: pd.DataFrame


def run_aggregation_sensitivity(
    *,
    contract_path: str | Path,
    cache_db_path: str | None = None,
    tables_dir: str | Path | None = None,
    reference_method: str = "weighted_linear_pool",
) -> AggregationSensitivityOutputs:
    contract = load_analysis_contract(contract_path)
    bundle = load_snapshot_bundle_for_contract(
        contract_path=str(contract.path),
        cache_db_path=cache_db_path,
        validate_cache=True,
    ).bundle
    sample_methods = compute_sample_method_metrics(bundle.responses)
    contrast_registry = load_contrast_registry_table(
        contract_path=contract.path,
        tables_dir=tables_dir,
    )
    return summarize_method_sensitivity(
        sample_methods,
        contrast_registry=contrast_registry,
        reference_method=reference_method,
    )


def load_contrast_registry_table(
    *,
    contract_path: str | Path,
    tables_dir: str | Path | None = None,
) -> pd.DataFrame:
    contract = load_analysis_contract(contract_path)
    resolved_tables = _resolve_tables_dir(contract, tables_dir)
    registry_csv = resolved_tables / "contrast_registry.csv"
    if registry_csv.exists():
        frame = pd.read_csv(registry_csv)
        expected = {"contrast_id", "baseline_tag", "variant_tag"}
        missing = expected - set(frame.columns)
        if missing:
            raise ValueError(f"contrast_registry.csv missing columns: {sorted(missing)}")
        return frame

    registry = load_contrast_registry(contract)
    rows: list[dict[str, Any]] = []
    for contrast in registry.contrasts:
        rows.append(
            {
                "contrast_id": contrast.contrast_id,
                "family_slug": contrast.family_slug,
                "contrast_kind": contrast.contrast_kind,
                "baseline_tag": contrast.baseline_tag,
                "variant_tag": contrast.variant_tag,
                "match_mode": contrast.mode,
            }
        )
    return pd.DataFrame(rows)


def compute_sample_method_metrics(
    responses: pd.DataFrame,
) -> pd.DataFrame:
    _validate_response_columns(responses)
    if responses.empty:
        return pd.DataFrame(
            columns=[
                *_SAMPLE_KEYS,
                "method",
                "n_observations",
                "abstain_rate",
                "singleton_rate",
                "mean_subset_size",
                "expected_stage",
                "mid_scale_mass",
                "entropy_norm",
                "top1_prob",
                "conflict",
            ],
        )

    normalized = responses.copy()
    normalized["model_id"] = normalized["model"].astype(str)
    normalized["scale_size"] = normalized["scale_size"].astype(int)

    records: list[dict[str, Any]] = []
    grouped = normalized.groupby(_SAMPLE_KEYS, dropna=False, sort=True)
    for (experiment_tag, sample_ordinal, model_id, scale_size), group in grouped:
        records.extend(
            _compute_for_sample(
                experiment_tag=str(experiment_tag),
                sample_ordinal=int(sample_ordinal),
                model_id=str(model_id),
                scale_size=int(scale_size),
                responses=group,
            ),
        )
    frame = pd.DataFrame.from_records(records)
    if frame.empty:
        return frame
    frame["method"] = pd.Categorical(frame["method"], categories=_METHOD_ORDER, ordered=True)
    return frame.sort_values(_SAMPLE_KEYS + ["method"]).reset_index(drop=True)


def summarize_method_sensitivity(
    sample_methods: pd.DataFrame,
    *,
    contrast_registry: pd.DataFrame | None = None,
    reference_method: str = "weighted_linear_pool",
) -> AggregationSensitivityOutputs:
    if sample_methods.empty:
        empty = pd.DataFrame()
        return AggregationSensitivityOutputs(
            sample_methods=sample_methods.copy(),
            method_summary=empty.copy(),
            method_alignment=empty.copy(),
            contrast_sensitivity=empty.copy(),
            report_panel=empty.copy(),
        )

    method_summary = _build_method_summary(sample_methods)
    method_alignment = _build_method_alignment(sample_methods, reference_method=reference_method)
    contrast_sensitivity = _build_contrast_sensitivity(sample_methods, contrast_registry)
    report_panel = _build_report_panel(method_summary, method_alignment, reference_method=reference_method)

    return AggregationSensitivityOutputs(
        sample_methods=sample_methods.copy(),
        method_summary=method_summary,
        method_alignment=method_alignment,
        contrast_sensitivity=contrast_sensitivity,
        report_panel=report_panel,
    )


def write_aggregation_sensitivity_outputs(
    outputs: AggregationSensitivityOutputs,
    *,
    output_dir: str | Path,
) -> dict[str, Path]:
    destination = Path(output_dir).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    mapping = {
        "sample_methods": destination / "aggregation_sensitivity_sample_methods.csv",
        "method_summary": destination / "aggregation_sensitivity_method_summary.csv",
        "method_alignment": destination / "aggregation_sensitivity_method_alignment.csv",
        "contrast_sensitivity": destination / "aggregation_sensitivity_contrast_sensitivity.csv",
        "report_panel": destination / "aggregation_sensitivity_report_panel.csv",
    }
    outputs.sample_methods.to_csv(mapping["sample_methods"], index=False)
    outputs.method_summary.to_csv(mapping["method_summary"], index=False)
    outputs.method_alignment.to_csv(mapping["method_alignment"], index=False)
    outputs.contrast_sensitivity.to_csv(mapping["contrast_sensitivity"], index=False)
    outputs.report_panel.to_csv(mapping["report_panel"], index=False)
    return mapping


def _compute_for_sample(
    *,
    experiment_tag: str,
    sample_ordinal: int,
    model_id: str,
    scale_size: int,
    responses: pd.DataFrame,
) -> list[dict[str, Any]]:
    observations: list[VerdictObservation] = []
    stage_vectors: list[np.ndarray] = []
    weights: list[float] = []
    response_payloads: list[dict[str, Any]] = []

    for row in responses.itertuples(index=False):
        decoded_scores = _as_int_list(getattr(row, "decoded_scores", []))
        abstained = bool(getattr(row, "abstained", False))
        observations.append(VerdictObservation(tuple(decoded_scores), abstained=abstained))
        stage_vectors.append(
            verdict_to_stage_probabilities(
                decoded_scores,
                scale_size,
                abstained=abstained,
                abstain_policy="zeros",
            ),
        )
        weights.append(_safe_non_negative(getattr(row, "score_expert_agreement_prob", 1.0), fallback=1.0))
        response_payloads.append(
            {
                "decoded_scores": decoded_scores,
                "abstained": abstained,
                "score_expert_agreement_prob": _safe_non_negative(
                    getattr(row, "score_expert_agreement_prob", 1.0),
                    fallback=1.0,
                ),
                "rubric_observability_score": _safe_non_negative(
                    getattr(row, "rubric_observability_score", 1.0),
                    fallback=1.0,
                ),
                "rubric_discriminability_score": _safe_non_negative(
                    getattr(row, "rubric_discriminability_score", 1.0),
                    fallback=1.0,
                ),
            },
        )

    geometry = geometry_support_summary(observations, scale_size)
    geometry_distribution = _mean_non_abstain_distribution(stage_vectors)
    retained_vectors, retained_weights = _retain_nonzero_stage_vectors(stage_vectors, weights)
    pooling_weights = retained_weights if sum(retained_weights) > 0.0 else None
    weighted_distribution = weighted_linear_opinion_pool(retained_vectors, weights=pooling_weights)
    log_distribution = log_opinion_pool(retained_vectors, weights=pooling_weights)

    tbm_result = aggregate_local_tbm(response_payloads, scale_size=scale_size)
    closed_world_result = aggregate_local_closed_world(response_payloads, scale_size=scale_size)

    shared = {
        "experiment_tag": experiment_tag,
        "sample_ordinal": sample_ordinal,
        "model_id": model_id,
        "scale_size": scale_size,
        "n_observations": int(len(responses)),
        "abstain_rate": _to_float(geometry.get("abstain_rate")),
        "singleton_rate": _to_float(geometry.get("singleton_rate")),
        "mean_subset_size": _to_float(geometry.get("mean_subset_size")),
    }

    return [
        {
            **shared,
            "method": "geometry_first",
            "expected_stage": _to_float(geometry.get("expected_stage")),
            "mid_scale_mass": _to_float(geometry.get("mid_scale_mass")),
            "entropy_norm": _entropy_norm(geometry_distribution),
            "top1_prob": _top1_prob(geometry_distribution),
            "conflict": np.nan,
        },
        {
            **shared,
            "method": "weighted_linear_pool",
            "expected_stage": _expected_stage(weighted_distribution),
            "mid_scale_mass": _mid_scale_mass(weighted_distribution),
            "entropy_norm": _entropy_norm(weighted_distribution),
            "top1_prob": _top1_prob(weighted_distribution),
            "conflict": np.nan,
        },
        {
            **shared,
            "method": "log_opinion_pool",
            "expected_stage": _expected_stage(log_distribution),
            "mid_scale_mass": _mid_scale_mass(log_distribution),
            "entropy_norm": _entropy_norm(log_distribution),
            "top1_prob": _top1_prob(log_distribution),
            "conflict": np.nan,
        },
        {
            **shared,
            "method": "local_tbm",
            "expected_stage": _expected_stage(tbm_result.stage_probabilities if tbm_result else None),
            "mid_scale_mass": _mid_scale_mass(tbm_result.stage_probabilities if tbm_result else None),
            "entropy_norm": _entropy_norm(tbm_result.stage_probabilities if tbm_result else None),
            "top1_prob": _top1_prob(tbm_result.stage_probabilities if tbm_result else None),
            "conflict": float(tbm_result.conflict) if tbm_result else np.nan,
        },
        {
            **shared,
            "method": "local_closed_world",
            "expected_stage": _expected_stage(closed_world_result.stage_probabilities if closed_world_result else None),
            "mid_scale_mass": _mid_scale_mass(closed_world_result.stage_probabilities if closed_world_result else None),
            "entropy_norm": _entropy_norm(closed_world_result.stage_probabilities if closed_world_result else None),
            "top1_prob": _top1_prob(closed_world_result.stage_probabilities if closed_world_result else None),
            "conflict": float(closed_world_result.conflict) if closed_world_result else np.nan,
        },
    ]


def _retain_nonzero_stage_vectors(
    stage_vectors: list[np.ndarray],
    weights: list[float],
) -> tuple[list[np.ndarray], list[float]]:
    retained_vectors: list[np.ndarray] = []
    retained_weights: list[float] = []
    for vector, weight in zip(stage_vectors, weights, strict=False):
        if float(np.asarray(vector, dtype=float).sum()) <= 0.0:
            continue
        retained_vectors.append(vector)
        retained_weights.append(weight)
    return retained_vectors, retained_weights


def _build_method_summary(sample_methods: pd.DataFrame) -> pd.DataFrame:
    grouped = sample_methods.groupby(["method", "model_id", "scale_size"], dropna=False, sort=True)
    summary = grouped.agg(
        n_samples=("sample_ordinal", "count"),
        mean_expected_stage=("expected_stage", "mean"),
        mean_entropy_norm=("entropy_norm", "mean"),
        mean_top1_prob=("top1_prob", "mean"),
        mean_conflict=("conflict", "mean"),
        mean_abstain_rate=("abstain_rate", "mean"),
        mean_singleton_rate=("singleton_rate", "mean"),
        mean_subset_size=("mean_subset_size", "mean"),
    ).reset_index()
    return summary.sort_values(["method", "model_id", "scale_size"]).reset_index(drop=True)


def _build_method_alignment(
    sample_methods: pd.DataFrame,
    *,
    reference_method: str,
) -> pd.DataFrame:
    reference = sample_methods[sample_methods["method"] == reference_method].copy()
    if reference.empty:
        return pd.DataFrame(
            columns=[
                "method",
                "model_id",
                "scale_size",
                "n_samples",
                "expected_stage_mae",
                "expected_stage_bias",
                "entropy_norm_mae",
                "top1_prob_mae",
                "conflict_delta_mean",
            ],
        )

    records: list[dict[str, Any]] = []
    reference = reference.rename(
        columns={
            "expected_stage": "expected_stage_ref",
            "entropy_norm": "entropy_norm_ref",
            "top1_prob": "top1_prob_ref",
            "conflict": "conflict_ref",
        },
    )
    key_cols = _SAMPLE_KEYS
    for method in [name for name in _METHOD_ORDER if name != reference_method]:
        current = sample_methods[sample_methods["method"] == method].copy()
        merged = current.merge(
            reference[key_cols + ["expected_stage_ref", "entropy_norm_ref", "top1_prob_ref", "conflict_ref"]],
            on=key_cols,
            how="inner",
        )
        if merged.empty:
            continue
        grouped = merged.groupby(["method", "model_id", "scale_size"], sort=True, dropna=False)
        for keys, group in grouped:
            records.append(
                {
                    "method": keys[0],
                    "model_id": keys[1],
                    "scale_size": int(keys[2]),
                    "n_samples": int(len(group)),
                    "expected_stage_mae": _nanmean_or_nan(np.abs(group["expected_stage"] - group["expected_stage_ref"])),
                    "expected_stage_bias": _nanmean_or_nan(group["expected_stage"] - group["expected_stage_ref"]),
                    "entropy_norm_mae": _nanmean_or_nan(np.abs(group["entropy_norm"] - group["entropy_norm_ref"])),
                    "top1_prob_mae": _nanmean_or_nan(np.abs(group["top1_prob"] - group["top1_prob_ref"])),
                    "conflict_delta_mean": _nanmean_or_nan(group["conflict"] - group["conflict_ref"]),
                }
            )
    return pd.DataFrame.from_records(records).sort_values(["method", "model_id", "scale_size"]).reset_index(drop=True)


def _build_contrast_sensitivity(
    sample_methods: pd.DataFrame,
    contrast_registry: pd.DataFrame | None,
) -> pd.DataFrame:
    if contrast_registry is None or contrast_registry.empty:
        return pd.DataFrame(
            columns=[
                "contrast_id",
                "family_slug",
                "contrast_kind",
                "method",
                "endpoint",
                "n_pairs",
                "mean_delta",
                "median_delta",
                "std_delta",
            ],
        )
    required = {"contrast_id", "baseline_tag", "variant_tag"}
    if not required.issubset(set(contrast_registry.columns)):
        raise ValueError("contrast registry must include contrast_id, baseline_tag, variant_tag")

    metadata_columns = ["family_slug", "contrast_kind", "baseline_tag", "variant_tag"]
    metadata = contrast_registry.copy()
    for column in metadata_columns:
        if column not in metadata.columns:
            metadata[column] = ""

    records: list[dict[str, Any]] = []
    sample_small = sample_methods[
        [
            "experiment_tag",
            "sample_ordinal",
            "method",
            "expected_stage",
            "entropy_norm",
            "top1_prob",
            "conflict",
        ]
    ].copy()
    for contrast in metadata.itertuples(index=False):
        baseline = sample_small[sample_small["experiment_tag"] == contrast.baseline_tag].rename(
            columns={
                "expected_stage": "expected_stage_baseline",
                "entropy_norm": "entropy_norm_baseline",
                "top1_prob": "top1_prob_baseline",
                "conflict": "conflict_baseline",
            },
        )
        variant = sample_small[sample_small["experiment_tag"] == contrast.variant_tag].rename(
            columns={
                "expected_stage": "expected_stage_variant",
                "entropy_norm": "entropy_norm_variant",
                "top1_prob": "top1_prob_variant",
                "conflict": "conflict_variant",
            },
        )
        merged = baseline.merge(
            variant,
            on=["sample_ordinal", "method"],
            how="inner",
        )
        if merged.empty:
            continue
        for endpoint in _SENSITIVITY_ENDPOINTS:
            delta = merged[f"{endpoint}_variant"] - merged[f"{endpoint}_baseline"]
            method_grouped = merged.assign(delta=delta).groupby("method", sort=True)
            for method_name, method_rows in method_grouped:
                records.append(
                    {
                        "contrast_id": str(contrast.contrast_id),
                        "family_slug": str(contrast.family_slug),
                        "contrast_kind": str(contrast.contrast_kind),
                        "baseline_tag": str(contrast.baseline_tag),
                        "variant_tag": str(contrast.variant_tag),
                        "method": str(method_name),
                        "endpoint": endpoint,
                        "n_pairs": int(method_rows["delta"].notna().sum()),
                        "mean_delta": _nanmean_or_nan(method_rows["delta"]),
                        "median_delta": _nanmedian_or_nan(method_rows["delta"]),
                        "std_delta": _nanstd_or_nan(method_rows["delta"]),
                    }
                )
    if not records:
        return pd.DataFrame()
    frame = pd.DataFrame.from_records(records)
    frame["method"] = pd.Categorical(frame["method"], categories=_METHOD_ORDER, ordered=True)
    return frame.sort_values(["contrast_id", "method", "endpoint"]).reset_index(drop=True)


def _build_report_panel(
    method_summary: pd.DataFrame,
    method_alignment: pd.DataFrame,
    *,
    reference_method: str,
) -> pd.DataFrame:
    if method_summary.empty:
        return pd.DataFrame()
    base = method_summary.groupby("method", dropna=False, sort=True).agg(
        n_samples=("n_samples", "sum"),
        mean_expected_stage=("mean_expected_stage", "mean"),
        mean_entropy_norm=("mean_entropy_norm", "mean"),
        mean_top1_prob=("mean_top1_prob", "mean"),
        mean_conflict=("mean_conflict", "mean"),
    ).reset_index()
    alignment_small = method_alignment.groupby("method", dropna=False, sort=True).agg(
        expected_stage_mae_vs_reference=("expected_stage_mae", "mean"),
        entropy_norm_mae_vs_reference=("entropy_norm_mae", "mean"),
        top1_prob_mae_vs_reference=("top1_prob_mae", "mean"),
    ).reset_index()
    panel = base.merge(alignment_small, on="method", how="left")
    panel["reference_method"] = reference_method
    panel["is_reference"] = panel["method"] == reference_method
    panel["method"] = pd.Categorical(panel["method"], categories=_METHOD_ORDER, ordered=True)
    return panel.sort_values("method").reset_index(drop=True)


def _resolve_tables_dir(contract: Any, tables_dir: str | Path | None) -> Path:
    if tables_dir is not None:
        return resolve_repo_path(tables_dir)
    payload = contract.payload
    outputs = payload.get("outputs", {})
    root = outputs.get("investigationRoot")
    if not isinstance(root, str) or not root:
        raise ValueError("analysis contract outputs.investigationRoot is required")
    return resolve_repo_path(Path(root) / "tables")


def _validate_response_columns(responses: pd.DataFrame) -> None:
    required = {
        "experiment_tag",
        "sample_ordinal",
        "model",
        "scale_size",
        "decoded_scores",
        "abstained",
    }
    missing = required - set(responses.columns)
    if missing:
        raise ValueError(f"responses missing required columns: {sorted(missing)}")


def _as_int_list(value: Any) -> list[int]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        result: list[int] = []
        for item in value:
            try:
                result.append(int(item))
            except (TypeError, ValueError):
                continue
        return result
    return []


def _safe_non_negative(value: Any, *, fallback: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    if np.isnan(numeric):
        return fallback
    return float(max(0.0, numeric))


def _mean_non_abstain_distribution(stage_vectors: list[np.ndarray]) -> np.ndarray:
    if not stage_vectors:
        return np.array([], dtype=float)
    matrix = np.vstack(stage_vectors)
    row_sums = matrix.sum(axis=1)
    keep = row_sums > 0.0
    if not keep.any():
        return np.zeros(matrix.shape[1], dtype=float)
    mean = matrix[keep].mean(axis=0)
    total = float(mean.sum())
    if total <= 0.0:
        return np.zeros(matrix.shape[1], dtype=float)
    return mean / total


def _expected_stage(values: Any) -> float:
    vector = _as_vector(values)
    if vector.size == 0:
        return np.nan
    total = float(vector.sum())
    if total <= 0.0:
        return np.nan
    probs = vector / total
    support = np.arange(1, len(probs) + 1, dtype=float)
    return float(np.dot(probs, support))


def _entropy_norm(values: Any) -> float:
    vector = _as_vector(values)
    if vector.size == 0:
        return np.nan
    total = float(vector.sum())
    if total <= 0.0:
        return np.nan
    probs = vector / total
    positive = probs[probs > 0.0]
    if positive.size == 0:
        return 0.0
    entropy = float(-(positive * np.log2(positive)).sum())
    max_entropy = float(np.log2(len(probs))) if len(probs) > 1 else 0.0
    if max_entropy <= 0.0:
        return 0.0
    return entropy / max_entropy


def _mid_scale_mass(values: Any) -> float:
    vector = _as_vector(values)
    if vector.size <= 2:
        return 0.0 if vector.size > 0 else np.nan
    total = float(vector.sum())
    if total <= 0.0:
        return np.nan
    probs = vector / total
    return float(np.sum(probs[1:-1]))


def _top1_prob(values: Any) -> float:
    vector = _as_vector(values)
    if vector.size == 0:
        return np.nan
    total = float(vector.sum())
    if total <= 0.0:
        return np.nan
    probs = vector / total
    return float(np.max(probs))


def _as_vector(values: Any) -> np.ndarray:
    if values is None:
        return np.array([], dtype=float)
    vector = np.asarray(values, dtype=float)
    if vector.ndim != 1:
        return np.array([], dtype=float)
    return vector


def _to_float(value: Any) -> float:
    if value is None:
        return np.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return np.nan


def _nanmean_or_nan(values: Any) -> float:
    vector = np.asarray(values, dtype=float)
    finite = vector[np.isfinite(vector)]
    if finite.size == 0:
        return np.nan
    return float(np.mean(finite))


def _nanmedian_or_nan(values: Any) -> float:
    vector = np.asarray(values, dtype=float)
    finite = vector[np.isfinite(vector)]
    if finite.size == 0:
        return np.nan
    return float(np.median(finite))


def _nanstd_or_nan(values: Any) -> float:
    vector = np.asarray(values, dtype=float)
    finite = vector[np.isfinite(vector)]
    if finite.size == 0:
        return np.nan
    return float(np.std(finite, ddof=0))
