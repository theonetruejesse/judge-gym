from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import numpy as np
import pandas as pd

from .cache import default_cache_path
from .collect import pull_experiments
from .contracts import repo_root
from .report_templates import format_bullet_lines, format_markdown_table

V4_NATIVE_GPT41_EXPERIMENT_TAGS = [
    "v4_native_fascism_baseline_source_gpt41",
    "v4_native_fascism_abstention_source_gpt41",
    "v4_native_fascism_view_l2_neutralized_gpt41",
    "v4_native_illiberal_democracy_baseline_source_gpt41",
    "v4_native_illiberal_democracy_abstention_source_gpt41",
    "v4_native_illiberal_democracy_view_l2_neutralized_gpt41",
]


@dataclass(frozen=True)
class NativeV4AnalysisOutputs:
    output_dir: Path
    report_path: Path
    summary_json_path: Path
    experiment_metrics_path: Path
    contrast_metrics_path: Path
    item_deltas_path: Path
    evidence_inventory_path: Path


@dataclass(frozen=True)
class ContrastSpec:
    contrast_id: str
    family: str
    baseline_tag: str
    variant_tag: str
    baseline_label: str
    variant_label: str


def generate_v4_native_report(
    *,
    convex_url: str | None = None,
    cache_db_path: str | None = None,
    output_dir: str | Path | None = None,
    refresh: bool = False,
    page_size: int = 200,
) -> NativeV4AnalysisOutputs:
    deployment_url = convex_url or _resolve_convex_url()
    cache_path = str(Path(cache_db_path) if cache_db_path else default_cache_path())
    target_dir = Path(output_dir) if output_dir else (
        repo_root() / "apps" / "analysis" / "_outputs" / "v4" / "native_gpt41"
    )
    target_dir.mkdir(parents=True, exist_ok=True)

    pulled = pull_experiments(
        V4_NATIVE_GPT41_EXPERIMENT_TAGS,
        deployment_url=deployment_url,
        cache_db_path=cache_path,
        refresh=refresh,
        page_size=page_size,
    )
    responses = pulled.scores.copy()
    evidence = pulled.evidence.copy()

    responses["decoded_scores"] = responses["decoded_scores"].apply(_normalize_scores)
    responses["expected_stage"] = responses["decoded_scores"].apply(_expected_stage)
    responses["is_singleton"] = responses["decoded_scores"].apply(lambda values: len(values) == 1)
    responses["geometry_bucket"] = responses.apply(
        lambda row: _verdict_geometry_bucket(
            decoded_scores=row["decoded_scores"],
            abstained=bool(row["abstained"]),
        ),
        axis=1,
    )
    responses["evidence_signature"] = responses["evidence_item_ids"].apply(
        lambda values: "|".join(str(value) for value in values),
    )
    responses["evidence_label_signature"] = responses["evidence_labels"].apply(
        lambda values: "|".join(str(value) for value in values),
    )
    responses["primary_evidence_label"] = responses["evidence_labels"].apply(
        lambda values: str(values[0]) if values else "",
    )
    responses["primary_evidence_title"] = responses["evidence_titles"].apply(
        lambda values: str(values[0]) if values else "",
    )
    responses["primary_evidence_url"] = responses["evidence_urls"].apply(
        lambda values: str(values[0]) if values else "",
    )
    responses["decoded_signature"] = responses["decoded_scores"].apply(
        lambda values: "|".join(str(value) for value in values),
    )
    responses["concept_key"] = responses["experiment_tag"].apply(_concept_key_from_tag)
    responses["condition_key"] = responses["experiment_tag"].apply(_condition_key_from_tag)
    responses["view_key"] = responses["evidence_view"].astype(str)

    experiment_metrics = _build_experiment_metrics(
        responses=responses,
        experiments=pulled.experiments,
    )
    contrast_specs = _contrast_specs()
    contrast_metrics = _build_contrast_metrics(
        responses=responses,
        contrast_specs=contrast_specs,
    )
    item_deltas = _build_item_deltas(
        responses=responses,
        contrast_specs=contrast_specs,
    )
    evidence_inventory = _build_evidence_inventory(evidence=evidence)

    summary = _build_summary(
        responses=responses,
        experiment_metrics=experiment_metrics,
        contrast_metrics=contrast_metrics,
        evidence_inventory=evidence_inventory,
    )

    experiment_metrics_path = target_dir / "experiment_metrics.csv"
    contrast_metrics_path = target_dir / "contrast_metrics.csv"
    item_deltas_path = target_dir / "item_deltas.csv"
    evidence_inventory_path = target_dir / "evidence_inventory.csv"
    summary_json_path = target_dir / "summary.json"
    report_path = target_dir / "report.md"

    experiment_metrics.to_csv(experiment_metrics_path, index=False)
    contrast_metrics.to_csv(contrast_metrics_path, index=False)
    item_deltas.to_csv(item_deltas_path, index=False)
    evidence_inventory.to_csv(evidence_inventory_path, index=False)
    summary_json_path.write_text(json.dumps(summary, indent=2, sort_keys=True))
    report_path.write_text(
        _render_markdown_report(
            summary=summary,
            experiment_metrics=experiment_metrics,
            contrast_metrics=contrast_metrics,
            item_deltas=item_deltas,
            evidence_inventory=evidence_inventory,
        )
    )

    return NativeV4AnalysisOutputs(
        output_dir=target_dir,
        report_path=report_path,
        summary_json_path=summary_json_path,
        experiment_metrics_path=experiment_metrics_path,
        contrast_metrics_path=contrast_metrics_path,
        item_deltas_path=item_deltas_path,
        evidence_inventory_path=evidence_inventory_path,
    )


def _resolve_convex_url() -> str:
    direct = os.environ.get("CONVEX_URL")
    if direct:
        return direct

    env_path = repo_root() / ".env.local"
    if env_path.exists():
        for raw_line in env_path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "CONVEX_URL":
                return value.strip().strip("\"' ")
    raise ValueError("CONVEX_URL is required")


def _normalize_scores(values: Any) -> list[int]:
    if isinstance(values, list):
        return [int(value) for value in values if value is not None]
    return []


def _safe_mean(values: pd.Series) -> float:
    series = pd.to_numeric(values, errors="coerce").dropna()
    if series.empty:
        return float("nan")
    return float(series.mean())


def _expected_stage(decoded_scores: list[int]) -> float:
    if not decoded_scores:
        return float("nan")
    return float(np.mean(decoded_scores))


def _mean_stage_distribution(verdicts: list[list[int]], scale_size: int) -> np.ndarray:
    distribution = np.zeros(scale_size, dtype=float)
    count = 0
    for verdict in verdicts:
        stages = [int(value) for value in verdict if value]
        if not stages:
            continue
        weight = 1.0 / len(stages)
        for stage in stages:
            if 1 <= stage <= scale_size:
                distribution[stage - 1] += weight
        count += 1
    if count == 0:
        return distribution
    return distribution / count


def _mid_scale_mass(distribution: np.ndarray) -> float:
    if len(distribution) <= 2:
        return 0.0
    return float(distribution[1:-1].sum())


def _normalized_stage_entropy(distribution: np.ndarray) -> float:
    positive = distribution[distribution > 0]
    if len(positive) == 0 or len(distribution) <= 1:
        return 0.0
    return float(-(positive * np.log2(positive)).sum() / np.log2(len(distribution)))


def _verdict_geometry_bucket(*, decoded_scores: list[int], abstained: bool) -> str:
    if abstained or not decoded_scores:
        return "abstain"
    values = sorted({int(value) for value in decoded_scores})
    if len(values) == 1:
        return "singleton"
    if len(values) >= 3:
        return "broad_subset"
    if all((right - left) == 1 for left, right in zip(values, values[1:])):
        return "adjacent_subset"
    return "non_adjacent_subset"


def _concept_key_from_tag(experiment_tag: str) -> str:
    if "_fascism_" in experiment_tag:
        return "fascism"
    if "_illiberal_democracy_" in experiment_tag:
        return "illiberal_democracy"
    raise ValueError(f"Unexpected concept tag: {experiment_tag}")


def _condition_key_from_tag(experiment_tag: str) -> str:
    if "_baseline_source_" in experiment_tag:
        return "baseline_source"
    if "_abstention_source_" in experiment_tag:
        return "abstention_source"
    if "_view_l2_neutralized_" in experiment_tag:
        return "view_l2_neutralized"
    raise ValueError(f"Unexpected condition tag: {experiment_tag}")


def _pretty_concept(value: str) -> str:
    return value.replace("_", " ")


def _pretty_condition(value: str) -> str:
    return value.replace("_", " ")


def _contrast_specs() -> list[ContrastSpec]:
    return [
        ContrastSpec(
            contrast_id="fascism:baseline_vs_abstention",
            family="abstention",
            baseline_tag="v4_native_fascism_baseline_source_gpt41",
            variant_tag="v4_native_fascism_abstention_source_gpt41",
            baseline_label="fascism baseline",
            variant_label="fascism abstention",
        ),
        ContrastSpec(
            contrast_id="illiberal_democracy:baseline_vs_abstention",
            family="abstention",
            baseline_tag="v4_native_illiberal_democracy_baseline_source_gpt41",
            variant_tag="v4_native_illiberal_democracy_abstention_source_gpt41",
            baseline_label="illiberal democracy baseline",
            variant_label="illiberal democracy abstention",
        ),
        ContrastSpec(
            contrast_id="fascism:source_vs_l2",
            family="evidence_view",
            baseline_tag="v4_native_fascism_baseline_source_gpt41",
            variant_tag="v4_native_fascism_view_l2_neutralized_gpt41",
            baseline_label="fascism source",
            variant_label="fascism l2",
        ),
        ContrastSpec(
            contrast_id="illiberal_democracy:source_vs_l2",
            family="evidence_view",
            baseline_tag="v4_native_illiberal_democracy_baseline_source_gpt41",
            variant_tag="v4_native_illiberal_democracy_view_l2_neutralized_gpt41",
            baseline_label="illiberal democracy source",
            variant_label="illiberal democracy l2",
        ),
        ContrastSpec(
            contrast_id="baseline:fascism_vs_illiberal_democracy",
            family="concept",
            baseline_tag="v4_native_fascism_baseline_source_gpt41",
            variant_tag="v4_native_illiberal_democracy_baseline_source_gpt41",
            baseline_label="fascism baseline",
            variant_label="illiberal democracy baseline",
        ),
        ContrastSpec(
            contrast_id="abstention:fascism_vs_illiberal_democracy",
            family="concept",
            baseline_tag="v4_native_fascism_abstention_source_gpt41",
            variant_tag="v4_native_illiberal_democracy_abstention_source_gpt41",
            baseline_label="fascism abstention",
            variant_label="illiberal democracy abstention",
        ),
        ContrastSpec(
            contrast_id="l2:fascism_vs_illiberal_democracy",
            family="concept",
            baseline_tag="v4_native_fascism_view_l2_neutralized_gpt41",
            variant_tag="v4_native_illiberal_democracy_view_l2_neutralized_gpt41",
            baseline_label="fascism l2",
            variant_label="illiberal democracy l2",
        ),
    ]


def _build_experiment_metrics(
    *,
    responses: pd.DataFrame,
    experiments: dict[str, dict[str, Any]],
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for experiment_tag, group in responses.groupby("experiment_tag", dropna=False):
        experiment = experiments[str(experiment_tag)]
        non_abstain = group[~group["abstained"]]
        scale_size = int(experiment["scale_size"])
        stage_distribution = _mean_stage_distribution(non_abstain["decoded_scores"].tolist(), scale_size)
        bucket_counts = group["geometry_bucket"].value_counts().to_dict()
        row = {
            "experiment_tag": experiment_tag,
            "concept": str(experiment["concept"]),
            "condition": _condition_key_from_tag(str(experiment_tag)),
            "evidence_view": str(experiment["evidence_view"]),
            "abstain_enabled": bool(experiment["abstain_enabled"]),
            "response_count": int(len(group)),
            "abstain_rate": float(group["abstained"].mean()),
            "singleton_rate": _safe_mean(non_abstain["is_singleton"]),
            "mean_subset_size": _safe_mean(non_abstain["subset_size"]),
            "mean_expected_stage": _safe_mean(non_abstain["expected_stage"]),
            "mid_scale_mass": _mid_scale_mass(stage_distribution),
            "stage_entropy": _normalized_stage_entropy(stage_distribution),
            "mean_score_expert_agreement_prob": _safe_mean(group["score_expert_agreement_prob"]),
            "abstain_bucket_rate": float(bucket_counts.get("abstain", 0) / len(group)),
            "singleton_bucket_rate": float(bucket_counts.get("singleton", 0) / len(group)),
            "adjacent_subset_rate": float(bucket_counts.get("adjacent_subset", 0) / len(group)),
            "broad_subset_rate": float(bucket_counts.get("broad_subset", 0) / len(group)),
            "non_adjacent_subset_rate": float(bucket_counts.get("non_adjacent_subset", 0) / len(group)),
        }
        for stage_number in range(1, scale_size + 1):
            row[f"mass_stage_{stage_number}"] = float(stage_distribution[stage_number - 1])
        rows.append(row)

    frame = pd.DataFrame(rows).sort_values(["concept", "condition"]).reset_index(drop=True)
    return frame


def _prepare_match_columns(frame: pd.DataFrame) -> pd.DataFrame:
    prepared = frame.copy()
    if "evidence_signature" not in prepared.columns:
        prepared["evidence_signature"] = prepared["evidence_item_ids"].apply(
            lambda values: "|".join(str(value) for value in values),
        )
    if "evidence_label_signature" not in prepared.columns:
        prepared["evidence_label_signature"] = prepared["evidence_labels"].apply(
            lambda values: "|".join(str(value) for value in values),
        )
    if "primary_evidence_label" not in prepared.columns:
        prepared["primary_evidence_label"] = prepared["evidence_labels"].apply(
            lambda values: str(values[0]) if values else "",
        )
    if "primary_evidence_title" not in prepared.columns:
        prepared["primary_evidence_title"] = prepared["evidence_titles"].apply(
            lambda values: str(values[0]) if values else "",
        )
    if "primary_evidence_url" not in prepared.columns:
        prepared["primary_evidence_url"] = prepared["evidence_urls"].apply(
            lambda values: str(values[0]) if values else "",
        )
    return prepared


def _build_contrast_metrics(
    *,
    responses: pd.DataFrame,
    contrast_specs: list[ContrastSpec],
) -> pd.DataFrame:
    responses = _prepare_match_columns(responses)
    rows: list[dict[str, Any]] = []
    for spec in contrast_specs:
        baseline = responses[responses["experiment_tag"] == spec.baseline_tag].copy()
        variant = responses[responses["experiment_tag"] == spec.variant_tag].copy()
        merged = baseline.merge(
            variant,
            on=["sample_ordinal", "evidence_signature", "evidence_label_signature"],
            suffixes=("_baseline", "_variant"),
        )
        if merged.empty:
            continue

        both_non_abstain = merged[(~merged["abstained_baseline"]) & (~merged["abstained_variant"])]
        rows.append(
            {
                "contrast_id": spec.contrast_id,
                "family": spec.family,
                "baseline_tag": spec.baseline_tag,
                "variant_tag": spec.variant_tag,
                "baseline_label": spec.baseline_label,
                "variant_label": spec.variant_label,
                "matched_items": int(len(merged)),
                "flip_count": int((merged["decoded_signature_baseline"] != merged["decoded_signature_variant"]).sum()),
                "flip_rate": float((merged["decoded_signature_baseline"] != merged["decoded_signature_variant"]).mean()),
                "geometry_flip_rate": float((merged["geometry_bucket_baseline"] != merged["geometry_bucket_variant"]).mean()),
                "abstain_delta": float(merged["abstained_variant"].mean() - merged["abstained_baseline"].mean()),
                "singleton_rate_delta": float(
                    _safe_mean(both_non_abstain["is_singleton_variant"]) - _safe_mean(both_non_abstain["is_singleton_baseline"])
                ),
                "mean_subset_size_delta": float(
                    _safe_mean(both_non_abstain["subset_size_variant"]) - _safe_mean(both_non_abstain["subset_size_baseline"])
                ),
                "mean_expected_stage_delta": float(
                    _safe_mean(both_non_abstain["expected_stage_variant"]) - _safe_mean(both_non_abstain["expected_stage_baseline"])
                ),
            }
        )
    return pd.DataFrame(rows)


def _build_item_deltas(
    *,
    responses: pd.DataFrame,
    contrast_specs: list[ContrastSpec],
) -> pd.DataFrame:
    responses = _prepare_match_columns(responses)
    rows: list[dict[str, Any]] = []
    for spec in contrast_specs:
        baseline = responses[responses["experiment_tag"] == spec.baseline_tag].copy()
        variant = responses[responses["experiment_tag"] == spec.variant_tag].copy()
        merged = baseline.merge(
            variant,
            on=["sample_ordinal", "evidence_signature", "evidence_label_signature"],
            suffixes=("_baseline", "_variant"),
        )
        for row in merged.itertuples():
            rows.append(
                {
                    "contrast_id": spec.contrast_id,
                    "evidence_label": row.primary_evidence_label_baseline,
                    "title": row.primary_evidence_title_baseline,
                    "url": row.primary_evidence_url_baseline,
                    "baseline_geometry": row.geometry_bucket_baseline,
                    "variant_geometry": row.geometry_bucket_variant,
                    "baseline_scores": row.decoded_signature_baseline,
                    "variant_scores": row.decoded_signature_variant,
                    "expected_stage_delta": _nan_safe_difference(
                        row.expected_stage_variant,
                        row.expected_stage_baseline,
                    ),
                    "subset_size_delta": int(row.subset_size_variant) - int(row.subset_size_baseline),
                    "flipped": row.decoded_signature_baseline != row.decoded_signature_variant,
                }
            )
    frame = pd.DataFrame(rows)
    if frame.empty:
        return frame
    return frame.sort_values(
        ["contrast_id", "flipped", "expected_stage_delta"],
        ascending=[True, False, False],
        key=lambda series: series.abs() if series.name == "expected_stage_delta" else series,
    ).reset_index(drop=True)


def _build_evidence_inventory(*, evidence: pd.DataFrame) -> pd.DataFrame:
    frame = evidence.copy()
    if "evidence_item_id" in frame.columns:
        frame = frame.drop_duplicates(subset=["evidence_item_id"]).copy()
    frame["domain"] = frame["url"].apply(_extract_domain)
    return frame.sort_values(["ordinal", "label"]).reset_index(drop=True)


def _extract_domain(url: str) -> str:
    try:
        return urlparse(str(url)).netloc or ""
    except ValueError:
        return ""


def _nan_safe_difference(left: float, right: float) -> float:
    if left is None or right is None:
        return float("nan")
    if math.isnan(left) or math.isnan(right):
        return float("nan")
    return float(left - right)


def _build_summary(
    *,
    responses: pd.DataFrame,
    experiment_metrics: pd.DataFrame,
    contrast_metrics: pd.DataFrame,
    evidence_inventory: pd.DataFrame,
) -> dict[str, Any]:
    source_counts = (
        evidence_inventory.groupby("source_name", dropna=False)
        .size()
        .reset_index(name="item_count")
        .sort_values(["item_count", "source_name"], ascending=[False, True])
    )
    domain_counts = (
        evidence_inventory.groupby("domain", dropna=False)
        .size()
        .reset_index(name="item_count")
        .sort_values(["item_count", "domain"], ascending=[False, True])
    )
    return {
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "experiment_count": int(experiment_metrics.shape[0]),
        "response_count": int(responses.shape[0]),
        "evidence_item_count": int(evidence_inventory["evidence_item_id"].nunique()),
        "top_sources": source_counts.head(10).to_dict(orient="records"),
        "top_domains": domain_counts.head(10).to_dict(orient="records"),
        "max_flip_contrast": (
            contrast_metrics.sort_values("flip_rate", ascending=False).head(1).to_dict(orient="records")[0]
            if not contrast_metrics.empty
            else None
        ),
    }


def _render_markdown_report(
    *,
    summary: dict[str, Any],
    experiment_metrics: pd.DataFrame,
    contrast_metrics: pd.DataFrame,
    item_deltas: pd.DataFrame,
    evidence_inventory: pd.DataFrame,
) -> str:
    experiment_rows = _format_rows(
        experiment_metrics[
            [
                "experiment_tag",
                "abstain_rate",
                "singleton_rate",
                "mean_subset_size",
                "mean_expected_stage",
                "mid_scale_mass",
                "stage_entropy",
            ]
        ]
    )
    contrast_rows = _format_rows(
        contrast_metrics[
            [
                "contrast_id",
                "flip_rate",
                "geometry_flip_rate",
                "abstain_delta",
                "mean_subset_size_delta",
                "mean_expected_stage_delta",
            ]
        ]
    )

    top_flip_lines: list[str] = []
    if not contrast_metrics.empty:
        for row in contrast_metrics.sort_values("flip_rate", ascending=False).head(4).itertuples():
            top_flip_lines.append(
                f"`{row.contrast_id}` flip rate `{row.flip_rate:.3f}`, expected-stage delta `{row.mean_expected_stage_delta:.3f}`, abstain delta `{row.abstain_delta:.3f}`"
            )

    item_examples = []
    if not item_deltas.empty:
        examples = item_deltas[item_deltas["flipped"] == True].head(8)  # noqa: E712
        for row in examples.itertuples():
            item_examples.append(
                {
                    "contrast_id": row.contrast_id,
                    "evidence_label": row.evidence_label,
                    "baseline_scores": row.baseline_scores,
                    "variant_scores": row.variant_scores,
                    "expected_stage_delta": f"{row.expected_stage_delta:.3f}" if not math.isnan(row.expected_stage_delta) else "nan",
                    "title": row.title,
                }
            )

    source_rows = _format_rows(
        evidence_inventory.groupby(["source_name", "domain"], dropna=False)
        .size()
        .reset_index(name="item_count")
        .sort_values(["item_count", "source_name"], ascending=[False, True])
        .head(10)
    )

    return "\n".join(
        [
            "# V4 Native GPT-4.1 Analysis",
            "",
            f"_Generated: {summary['generated_at']}_",
            "",
            "## Scope",
            "",
            format_bullet_lines(
                [
                    "shared Media Cloud evidence universe",
                    f"`{summary['evidence_item_count']}` curated evidence items",
                    f"`{summary['experiment_count']}` completed GPT-4.1 native experiments",
                    f"`{summary['response_count']}` total scored responses",
                ]
            ),
            "",
            "## Top Findings",
            "",
            format_bullet_lines(top_flip_lines),
            "",
            "## Experiment Geometry",
            "",
            format_markdown_table(
                rows=experiment_rows,
                columns=[
                    "experiment_tag",
                    "abstain_rate",
                    "singleton_rate",
                    "mean_subset_size",
                    "mean_expected_stage",
                    "mid_scale_mass",
                    "stage_entropy",
                ],
            ),
            "",
            "## Matched Contrasts",
            "",
            format_markdown_table(
                rows=contrast_rows,
                columns=[
                    "contrast_id",
                    "flip_rate",
                    "geometry_flip_rate",
                    "abstain_delta",
                    "mean_subset_size_delta",
                    "mean_expected_stage_delta",
                ],
            ),
            "",
            "## Example Item-Level Flips",
            "",
            format_markdown_table(
                rows=item_examples,
                columns=[
                    "contrast_id",
                    "evidence_label",
                    "baseline_scores",
                    "variant_scores",
                    "expected_stage_delta",
                    "title",
                ],
            ),
            "",
            "## Evidence Source Mix",
            "",
            format_markdown_table(
                rows=source_rows,
                columns=["source_name", "domain", "item_count"],
            ),
            "",
        ]
    )


def _format_rows(frame: pd.DataFrame) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for record in frame.to_dict(orient="records"):
        normalized: dict[str, object] = {}
        for key, value in record.items():
            if isinstance(value, float):
                normalized[key] = "nan" if math.isnan(value) else f"{value:.3f}"
            else:
                normalized[key] = value
        rows.append(normalized)
    return rows
