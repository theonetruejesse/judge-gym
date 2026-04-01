from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from .cache import default_cache_path
from .collect import ExperimentData
from .contracts import repo_root
from .datasets import load_snapshot_bundle
from .export import export_runs
from .report_templates import format_bullet_lines, format_markdown_table
from .report_v4_native import (
    _build_contrast_metrics,
    _build_evidence_inventory,
    _build_experiment_metrics,
    _build_item_deltas,
    _condition_key_from_tag,
    _concept_key_from_tag,
    _expected_stage,
    _normalize_scores,
    _pretty_concept,
    _verdict_geometry_bucket,
)

CANONICAL_OPENAI_MATRIX_PATH = (
    repo_root()
    / "docs"
    / "pilots"
    / "v4_native_openai_canonical_runs.json"
)


@dataclass(frozen=True)
class NativeOpenAiScaleOutputs:
    output_dir: Path
    report_path: Path
    summary_json_path: Path
    experiment_metrics_path: Path
    contrast_metrics_path: Path
    item_deltas_path: Path
    evidence_inventory_path: Path
    canonical_runs_path: Path


@dataclass(frozen=True)
class ContrastSpec:
    contrast_id: str
    family: str
    baseline_tag: str
    variant_tag: str
    baseline_label: str
    variant_label: str


def generate_v4_native_openai_report(
    *,
    convex_url: str | None = None,
    cache_db_path: str | None = None,
    output_dir: str | Path | None = None,
    refresh: bool = False,
    page_size: int = 200,
    canonical_runs_path: str | Path | None = None,
) -> NativeOpenAiScaleOutputs:
    deployment_url = convex_url or _resolve_convex_url()
    cache_path = str(Path(cache_db_path) if cache_db_path else default_cache_path())
    target_dir = Path(output_dir) if output_dir else (
        repo_root() / "apps" / "analysis" / "_outputs" / "v4" / "native_openai_scale"
    )
    target_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = Path(canonical_runs_path) if canonical_runs_path else CANONICAL_OPENAI_MATRIX_PATH
    manifest = json.loads(manifest_path.read_text())
    canonical_rows = list(manifest["canonical_runs"])
    run_ids = [str(row["canonical_run_id"]) for row in canonical_rows]

    snapshots = export_runs(
        run_ids=run_ids,
        deployment_url=deployment_url,
        cache_db_path=cache_path,
        refresh=refresh,
        page_size=page_size,
    )
    bundle = load_snapshot_bundle(
        snapshot_ids=[snapshot.snapshot_id for snapshot in snapshots],
        cache_db_path=cache_path,
    )
    pulled = ExperimentData(
        scores=bundle.responses,
        evidence=bundle.evidence,
        rubrics=bundle.rubrics,
        experiments=bundle.experiments,
        tags=bundle.experiment_tags,
        samples=bundle.samples,
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
    responses["decoded_signature"] = responses["decoded_scores"].apply(
        lambda values: "|".join(str(value) for value in values),
    )
    responses["concept_key"] = responses["experiment_tag"].apply(_concept_key_from_tag)
    responses["condition_key"] = responses["experiment_tag"].apply(_condition_key_from_tag)
    responses["model_key"] = responses["experiment_tag"].apply(_model_key_from_tag)

    experiment_metrics = _build_experiment_metrics(
        responses=responses,
        experiments=pulled.experiments,
    )
    if not experiment_metrics.empty:
        experiment_metrics["model"] = experiment_metrics["experiment_tag"].apply(_model_key_from_tag)
        experiment_metrics["condition_key"] = experiment_metrics["experiment_tag"].apply(_condition_key_from_tag)
    contrast_specs = _contrast_specs(canonical_rows)
    contrast_metrics = _build_contrast_metrics(
        responses=responses,
        contrast_specs=contrast_specs,
    )
    item_deltas = _build_item_deltas(
        responses=responses,
        contrast_specs=contrast_specs,
    )
    evidence_inventory = _build_evidence_inventory(evidence=evidence)

    provider_summary = _build_provider_summary(experiment_metrics)
    lane_summary = _build_lane_summary(experiment_metrics)
    summary = _build_summary(
        experiment_metrics=experiment_metrics,
        contrast_metrics=contrast_metrics,
        provider_summary=provider_summary,
        lane_summary=lane_summary,
        manifest=manifest,
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
            provider_summary=provider_summary,
            lane_summary=lane_summary,
            experiment_metrics=experiment_metrics,
            contrast_metrics=contrast_metrics,
        )
    )

    return NativeOpenAiScaleOutputs(
        output_dir=target_dir,
        report_path=report_path,
        summary_json_path=summary_json_path,
        experiment_metrics_path=experiment_metrics_path,
        contrast_metrics_path=contrast_metrics_path,
        item_deltas_path=item_deltas_path,
        evidence_inventory_path=evidence_inventory_path,
        canonical_runs_path=manifest_path,
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


def _model_key_from_tag(experiment_tag: str) -> str:
    for suffix, model in (
        ("_gpt41mini", "gpt-4.1-mini"),
        ("_gpt41", "gpt-4.1"),
        ("_gpt52chat", "gpt-5.2-chat"),
        ("_gpt52", "gpt-5.2"),
    ):
        if experiment_tag.endswith(suffix):
            return model
    raise ValueError(f"Unexpected model tag: {experiment_tag}")


def _contrast_specs(canonical_rows: list[dict[str, Any]]) -> list[ContrastSpec]:
    tags = {str(row["experiment_tag"]) for row in canonical_rows}
    specs: list[ContrastSpec] = []
    model_suffixes = ["gpt41", "gpt41mini", "gpt52", "gpt52chat"]
    for suffix in model_suffixes:
        fascism_baseline = f"v4_native_fascism_baseline_source_{suffix}"
        fascism_abstention = f"v4_native_fascism_abstention_source_{suffix}"
        fascism_l2 = f"v4_native_fascism_view_l2_neutralized_{suffix}"
        illiberal_baseline = f"v4_native_illiberal_democracy_baseline_source_{suffix}"
        illiberal_l2 = f"v4_native_illiberal_democracy_view_l2_neutralized_{suffix}"
        if fascism_baseline in tags and fascism_abstention in tags:
            specs.append(
                ContrastSpec(
                    contrast_id=f"{suffix}:fascism:baseline_vs_abstention",
                    family="within_model",
                    baseline_tag=fascism_baseline,
                    variant_tag=fascism_abstention,
                    baseline_label="fascism baseline source",
                    variant_label="fascism abstention source",
                )
            )
        if fascism_baseline in tags and fascism_l2 in tags:
            specs.append(
                ContrastSpec(
                    contrast_id=f"{suffix}:fascism:source_vs_l2",
                    family="within_model",
                    baseline_tag=fascism_baseline,
                    variant_tag=fascism_l2,
                    baseline_label="fascism baseline source",
                    variant_label="fascism l2 neutralized",
                )
            )
        if illiberal_baseline in tags and illiberal_l2 in tags:
            specs.append(
                ContrastSpec(
                    contrast_id=f"{suffix}:illiberal_democracy:source_vs_l2",
                    family="within_model",
                    baseline_tag=illiberal_baseline,
                    variant_tag=illiberal_l2,
                    baseline_label="illiberal democracy baseline source",
                    variant_label="illiberal democracy l2 neutralized",
                )
            )
        if fascism_baseline in tags and illiberal_baseline in tags:
            specs.append(
                ContrastSpec(
                    contrast_id=f"{suffix}:baseline:fascism_vs_illiberal_democracy",
                    family="within_model",
                    baseline_tag=fascism_baseline,
                    variant_tag=illiberal_baseline,
                    baseline_label="fascism baseline source",
                    variant_label="illiberal democracy baseline source",
                )
            )
    anchor_suffix = "gpt41"
    for suffix in ["gpt41mini", "gpt52", "gpt52chat"]:
        for stem in [
            "v4_native_fascism_baseline_source_",
            "v4_native_fascism_abstention_source_",
            "v4_native_fascism_view_l2_neutralized_",
            "v4_native_illiberal_democracy_baseline_source_",
            "v4_native_illiberal_democracy_view_l2_neutralized_",
        ]:
            anchor_tag = f"{stem}{anchor_suffix}"
            compare_tag = f"{stem}{suffix}"
            if anchor_tag in tags and compare_tag in tags:
                specs.append(
                    ContrastSpec(
                        contrast_id=f"{stem.removeprefix('v4_native_').removesuffix('_')}:{suffix}_vs_{anchor_suffix}",
                        family="cross_model",
                        baseline_tag=anchor_tag,
                        variant_tag=compare_tag,
                        baseline_label=f"{anchor_suffix} anchor",
                        variant_label=suffix,
                    )
                )
    return specs


def _build_provider_summary(experiment_metrics: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        experiment_metrics
        .groupby("model", as_index=False)
        .agg(
            experiment_count=("experiment_tag", "count"),
            mean_expected_stage=("mean_expected_stage", "mean"),
            mean_abstain_rate=("abstain_rate", "mean"),
            mean_singleton_rate=("singleton_rate", "mean"),
        )
    )
    return grouped.sort_values("model").reset_index(drop=True)


def _build_lane_summary(experiment_metrics: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        experiment_metrics
        .groupby(["concept", "condition_key"], as_index=False)
        .agg(
            experiment_count=("experiment_tag", "count"),
            mean_expected_stage=("mean_expected_stage", "mean"),
            mean_abstain_rate=("abstain_rate", "mean"),
            mean_singleton_rate=("singleton_rate", "mean"),
        )
    )
    return grouped.sort_values(["concept", "condition_key"]).reset_index(drop=True)


def _build_summary(
    *,
    experiment_metrics: pd.DataFrame,
    contrast_metrics: pd.DataFrame,
    provider_summary: pd.DataFrame,
    lane_summary: pd.DataFrame,
    manifest: dict[str, Any],
) -> dict[str, Any]:
    return {
        "matrix": {
            "experiment_count": int(len(experiment_metrics)),
            "provider_count": int(provider_summary["model"].nunique()),
            "lane_count": int(lane_summary.shape[0]),
            "target_count": int(manifest["target_count"]),
            "evidence_set_tag": manifest["evidence_set_tag"],
        },
        "strongest_within_model_contrasts": contrast_metrics[
            contrast_metrics["family"] == "within_model"
        ].sort_values("flip_rate", ascending=False).head(10).to_dict(orient="records"),
        "strongest_cross_model_contrasts": contrast_metrics[
            contrast_metrics["family"] == "cross_model"
        ].sort_values("flip_rate", ascending=False).head(10).to_dict(orient="records"),
    }


def _render_markdown_report(
    *,
    summary: dict[str, Any],
    provider_summary: pd.DataFrame,
    lane_summary: pd.DataFrame,
    experiment_metrics: pd.DataFrame,
    contrast_metrics: pd.DataFrame,
) -> str:
    return "\n".join(
        [
            "# V4 Native OpenAI Scale",
            "",
            f"- Experiments: `{summary['matrix']['experiment_count']}`",
            f"- Providers: `{summary['matrix']['provider_count']}`",
            f"- Samples per experiment: `{summary['matrix']['target_count']}`",
            f"- Evidence set: `{summary['matrix']['evidence_set_tag']}`",
            "",
            "## Provider Summary",
            "",
            format_markdown_table(
                rows=provider_summary.assign(
                    mean_expected_stage=provider_summary["mean_expected_stage"].map(lambda value: f"{value:.3f}"),
                    mean_abstain_rate=provider_summary["mean_abstain_rate"].map(lambda value: f"{value:.3f}"),
                    mean_singleton_rate=provider_summary["mean_singleton_rate"].map(lambda value: f"{value:.3f}"),
                ).to_dict(orient="records"),
                columns=[
                    "model",
                    "experiment_count",
                    "mean_expected_stage",
                    "mean_abstain_rate",
                    "mean_singleton_rate",
                ],
            ),
            "",
            "## Lane Summary",
            "",
            format_markdown_table(
                rows=lane_summary.assign(
                    concept=lane_summary["concept"].map(_pretty_concept),
                    mean_expected_stage=lane_summary["mean_expected_stage"].map(lambda value: f"{value:.3f}"),
                    mean_abstain_rate=lane_summary["mean_abstain_rate"].map(lambda value: f"{value:.3f}"),
                    mean_singleton_rate=lane_summary["mean_singleton_rate"].map(lambda value: f"{value:.3f}"),
                ).to_dict(orient="records"),
                columns=[
                    "concept",
                    "condition_key",
                    "experiment_count",
                    "mean_expected_stage",
                    "mean_abstain_rate",
                    "mean_singleton_rate",
                ],
            ),
            "",
            "## Strongest Contrasts",
            "",
            format_bullet_lines(
                [
                    f"`{row['contrast_id']}` flip `{row['flip_rate']:.3f}`; abstain delta `{row['abstain_delta']:.3f}`; expected-stage delta `{row['mean_expected_stage_delta']:.3f}`"
                    for row in contrast_metrics.sort_values("flip_rate", ascending=False).head(12).to_dict(orient="records")
                ]
            ),
            "",
            "## Experiment Metrics",
            "",
            format_markdown_table(
                rows=experiment_metrics.assign(
                    concept=experiment_metrics["concept"].map(_pretty_concept),
                    mean_expected_stage=experiment_metrics["mean_expected_stage"].map(lambda value: f"{value:.3f}"),
                    abstain_rate=experiment_metrics["abstain_rate"].map(lambda value: f"{value:.3f}"),
                    singleton_rate=experiment_metrics["singleton_rate"].map(lambda value: f"{value:.3f}"),
                    mean_subset_size=experiment_metrics["mean_subset_size"].map(lambda value: f"{value:.3f}"),
                ).to_dict(orient="records"),
                columns=[
                    "experiment_tag",
                    "model",
                    "concept",
                    "condition_key",
                    "mean_expected_stage",
                    "abstain_rate",
                    "singleton_rate",
                    "mean_subset_size",
                ],
            ),
            "",
        ]
    )
