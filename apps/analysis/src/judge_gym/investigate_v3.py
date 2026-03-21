from __future__ import annotations

import json
import math
import re
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from scipy.cluster.hierarchy import dendrogram, fcluster, leaves_list, linkage
from scipy.spatial.distance import squareform
import statsmodels.formula.api as smf

from .cache import connect_cache, record_artifact
from .datasets import SnapshotBundle, load_snapshot_bundle, load_snapshot_bundle_for_contract
from .figure_layout import (
    bucket_verdict_label,
    paginate_labels,
    should_annotate_heatmap,
    suggest_facet_grid,
)
from .figure_triage import build_repair_plan, load_figure_manifest
from .mine_v3 import mine_v3_findings, write_mining_summary
from .report_pilot import (
    _build_belief_frame,
    _build_experiment_metrics,
    _response_to_mass,
    family_groups_for_tags,
    family_slug_from_tag,
)
from .aggregation_sensitivity import (
    run_aggregation_sensitivity,
    write_aggregation_sensitivity_outputs,
)
from .rubric_embeddings import (
    DEFAULT_RUBRIC_EMBEDDING_MODEL,
    build_rubric_embedding_tables,
    vector_from_json,
)

PRIMARY_ENDPOINTS = [
    "abstain_rate",
    "singleton_rate",
    "mean_subset_size",
    "mean_expected_stage",
    "mid_scale_mass",
    "stage_entropy",
]

SECONDARY_ENDPOINTS = [
    "mean_score_expert_agreement_prob",
    "tbm_conflict",
    "closed_world_conflict",
]

RUBRIC_FOCUS_MODELS = [
    "gpt-4.1",
    "gpt-5.2",
    "gpt-4.1-mini",
    "gpt-5.2-chat",
]


@dataclass(frozen=True)
class FamilyContrast:
    contrast_id: str
    family_slug: str
    contrast_kind: str
    baseline_tag: str
    variant_tag: str
    baseline_label: str
    variant_label: str
    match_mode: str = "strict"


def default_investigation_root() -> Path:
    return Path(__file__).resolve().parents[2] / "_outputs" / "v3" / "investigation"


def generate_v3_investigation(
    *,
    snapshot_ids: list[str] | None = None,
    experiment_tags: list[str] | None = None,
    cache_db_path: str | None = None,
    output_dir: str | Path | None = None,
    contract_path: str | None = None,
    contrast_registry_path: str | None = None,
    figures_manifest_path: str | None = None,
    rubric_embedding_model: str = DEFAULT_RUBRIC_EMBEDDING_MODEL,
    rubric_embedding_encoder=None,
) -> Path:
    contract_artifacts = None
    if contract_path is not None:
        contract_bundle = load_snapshot_bundle_for_contract(
            contract_path=contract_path,
            contrast_registry_path=contrast_registry_path,
            figures_manifest_path=figures_manifest_path,
            cache_db_path=cache_db_path,
        )
        bundle = contract_bundle.bundle
        contract_artifacts = contract_bundle.artifacts
    else:
        bundle = load_snapshot_bundle(
            snapshot_ids=snapshot_ids,
            experiment_tags=experiment_tags,
            cache_db_path=cache_db_path,
        )
    root = Path(output_dir) if output_dir is not None else default_investigation_root()
    figures_dir = root / "figures"
    tables_dir = root / "tables"
    figures_dir.mkdir(parents=True, exist_ok=True)
    tables_dir.mkdir(parents=True, exist_ok=True)

    connection = connect_cache(cache_db_path)
    try:
        figure_repair_plan = _load_figure_repair_plan(figures_manifest_path)
        contrasts = (
            _build_family_contrasts_from_registry(contract_artifacts)
            if contract_artifacts is not None
            else _build_family_contrasts(bundle)
        )
        experiment_metrics = _build_experiment_metrics(bundle)
        experiment_geometry = _build_experiment_geometry(bundle)
        sample_metrics = _build_sample_metrics(bundle)
        evidence_metrics = _build_evidence_metrics(bundle)
        matching_details, matching_validation = _build_matching_tables(bundle, contrasts)
        rubric_embedding_tables = build_rubric_embedding_tables(
            bundle,
            model_name=rubric_embedding_model,
            encoder=rubric_embedding_encoder,
        )
        rubric_embeddings = rubric_embedding_tables["full"]
        rubric_stage_embeddings = rubric_embedding_tables["stage"]
        rubric_criterion_embeddings = rubric_embedding_tables["criterion"]
        rubric_experiment_similarity = _build_rubric_experiment_similarity(rubric_embeddings)
        rubric_focus_similarity = _build_rubric_focus_similarity(
            rubric_experiment_similarity=rubric_experiment_similarity,
            bundle=bundle,
        )
        rubric_stage_contrast_similarity = _build_rubric_stage_contrast_similarity(
            rubric_stage_embeddings=rubric_stage_embeddings,
            contrasts=contrasts,
            matching_details=matching_details,
        )
        rubric_contrast_similarity = _build_rubric_contrast_similarity(
            rubric_embeddings=rubric_embeddings,
            contrasts=contrasts,
            matching_details=matching_details,
        )
        rubric_experiment_clusters = _build_rubric_experiment_clusters(rubric_experiment_similarity)
        rubric_focus_clusters = _build_rubric_experiment_clusters(rubric_focus_similarity)
        scale_contrasts = (
            _build_scale_size_contrasts_from_registry(contract_artifacts)
            if contract_artifacts is not None
            else _build_scale_size_contrasts(bundle)
        )
        scale_matching_details, scale_matching_validation = _build_matching_tables(bundle, scale_contrasts)
        scale_certainty_effects, scale_certainty_regression = _build_scale_certainty_analysis(
            bundle=bundle,
            sample_metrics=sample_metrics,
            matching_details=scale_matching_details,
            contrasts=scale_contrasts,
        )
        family_pair_deltas = _build_family_pair_deltas(
            sample_metrics,
            matching_details,
            contrasts,
        )
        family_effects = _build_family_effects(family_pair_deltas)
        family_effects_qvalues = _build_family_effects_qvalues(family_effects)
        sample_instability = _build_sample_instability(sample_metrics)
        experiment_distances = _build_experiment_distances(experiment_metrics)
        bundle_verdict_profiles = _build_bundle_verdict_profiles(bundle)
        bundle_belief_tbm = _build_bundle_belief_profiles(bundle, closed_world=False)
        bundle_belief_closed = _build_bundle_belief_profiles(bundle, closed_world=True)
        verdict_geometry_certainty = _build_verdict_geometry_certainty(bundle)
        bundle_policy_deltas = _build_bundle_policy_deltas(family_effects)
        robust_summary_panel = _build_robust_summary_panel(bundle)
        contrast_registry_frame = _build_contrast_registry_frame(contrasts)
        candidate_findings = _build_candidate_findings(
            experiment_metrics=experiment_metrics,
            experiment_geometry=experiment_geometry,
            family_effects=family_effects,
            rubric_contrast_similarity=rubric_contrast_similarity,
            scale_certainty_effects=scale_certainty_effects,
            sample_instability=sample_instability,
        )

        outputs = {
            tables_dir / "experiment_metrics.csv": experiment_metrics,
            tables_dir / "experiment_geometry.csv": experiment_geometry,
            tables_dir / "rubric_embeddings.csv": rubric_embeddings,
            tables_dir / "rubric_stage_embeddings.csv": rubric_stage_embeddings,
            tables_dir / "rubric_criterion_embeddings.csv": rubric_criterion_embeddings,
            tables_dir / "rubric_experiment_similarity.csv": rubric_experiment_similarity,
            tables_dir / "rubric_experiment_clusters.csv": rubric_experiment_clusters,
            tables_dir / "rubric_focus_similarity.csv": rubric_focus_similarity,
            tables_dir / "rubric_focus_clusters.csv": rubric_focus_clusters,
            tables_dir / "rubric_contrast_similarity.csv": rubric_contrast_similarity,
            tables_dir / "rubric_stage_contrast_similarity.csv": rubric_stage_contrast_similarity,
            tables_dir / "sample_metrics.csv": sample_metrics,
            tables_dir / "evidence_metrics.csv": evidence_metrics,
            tables_dir / "matching_details.csv": matching_details,
            tables_dir / "matching_validation.csv": matching_validation,
            tables_dir / "scale_matching_details.csv": scale_matching_details,
            tables_dir / "scale_matching_validation.csv": scale_matching_validation,
            tables_dir / "scale_certainty_effects.csv": scale_certainty_effects,
            tables_dir / "scale_certainty_regression.csv": scale_certainty_regression,
            tables_dir / "contrast_registry.csv": contrast_registry_frame,
            tables_dir / "family_pair_deltas.csv": family_pair_deltas,
            tables_dir / "family_effects.csv": family_effects,
            tables_dir / "family_effects_qvalues.csv": family_effects_qvalues,
            tables_dir / "sample_instability.csv": sample_instability,
            tables_dir / "experiment_distances.csv": experiment_distances,
            tables_dir / "bundle_verdict_profiles.csv": bundle_verdict_profiles,
            tables_dir / "bundle_belief_tbm.csv": bundle_belief_tbm,
            tables_dir / "bundle_belief_closed_world.csv": bundle_belief_closed,
            tables_dir / "verdict_geometry_certainty.csv": verdict_geometry_certainty,
            tables_dir / "bundle_policy_deltas.csv": bundle_policy_deltas,
            tables_dir / "robust_summary_panel.csv": robust_summary_panel,
            tables_dir / "candidate_findings.csv": candidate_findings,
        }
        for path, frame in outputs.items():
            frame.to_csv(path, index=False)
            _record_for_all(
                connection,
                bundle.snapshot_ids,
                "table",
                path,
                report_name="v3_investigation",
            )

        if contract_path is not None:
            mining_output = mine_v3_findings(
                contract_path=contract_path,
                tables_dir=tables_dir,
                contrast_registry_path=contrast_registry_path,
            )
            mining_paths = write_mining_summary(
                mining_output,
                output_dir=tables_dir,
                markdown_name="mine_v3_summary.md",
                findings_name="mine_v3_ranked_findings.csv",
                summary_name="mine_v3_summary.json",
            )
            for path in mining_paths.values():
                _record_for_all(
                    connection,
                    bundle.snapshot_ids,
                    "table" if path.suffix == ".csv" else "report",
                    path,
                    report_name="v3_investigation",
                )

            aggregation_outputs = run_aggregation_sensitivity(
                contract_path=contract_path,
                cache_db_path=cache_db_path,
                tables_dir=tables_dir,
            )
            aggregation_paths = write_aggregation_sensitivity_outputs(
                aggregation_outputs,
                output_dir=tables_dir,
            )
            for path in aggregation_paths.values():
                _record_for_all(
                    connection,
                    bundle.snapshot_ids,
                    "table",
                    path,
                    report_name="v3_investigation",
                )

        figure_paths = _write_figures(
            bundle=bundle,
            experiment_geometry=experiment_geometry,
            experiment_metrics=experiment_metrics,
            family_effects=family_effects,
            rubric_experiment_similarity=rubric_experiment_similarity,
            rubric_focus_similarity=rubric_focus_similarity,
            rubric_stage_contrast_similarity=rubric_stage_contrast_similarity,
            sample_instability=sample_instability,
            sample_metrics=sample_metrics,
            scale_certainty_effects=scale_certainty_effects,
            bundle_verdict_profiles=bundle_verdict_profiles,
            bundle_belief_tbm=bundle_belief_tbm,
            bundle_belief_closed=bundle_belief_closed,
            figures_dir=figures_dir,
            figure_repair_plan=figure_repair_plan,
        )
        for path in figure_paths:
            _record_for_all(
                connection,
                bundle.snapshot_ids,
                "figure",
                path,
                report_name="v3_investigation",
            )

        report_path = root / "report.md"
        report_path.write_text(
            _build_markdown_report(
                bundle=bundle,
                candidate_findings=candidate_findings,
                experiment_distances=experiment_distances,
                experiment_geometry=experiment_geometry,
                experiment_metrics=experiment_metrics,
                matching_validation=matching_validation,
                family_effects=family_effects,
                rubric_contrast_similarity=rubric_contrast_similarity,
                rubric_focus_similarity=rubric_focus_similarity,
                rubric_stage_contrast_similarity=rubric_stage_contrast_similarity,
                scale_matching_validation=scale_matching_validation,
                scale_certainty_effects=scale_certainty_effects,
                scale_certainty_regression=scale_certainty_regression,
                sample_instability=sample_instability,
            )
        )
        _record_for_all(
            connection,
            bundle.snapshot_ids,
            "report",
            report_path,
            report_name="v3_investigation",
        )

        summary = {
            "snapshot_ids": bundle.snapshot_ids,
            "experiment_tags": bundle.experiment_tags,
            "contrast_count": len(contrasts),
            "matched_contrast_count": int(matching_validation["fully_matched"].sum()) if not matching_validation.empty else 0,
            "figure_count": len(figure_paths),
            "table_count": len(outputs),
        }
        summary_path = root / "summary.json"
        summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True))
        _record_for_all(
            connection,
            bundle.snapshot_ids,
            "summary",
            summary_path,
            report_name="v3_investigation",
            metadata=summary,
        )
    finally:
        connection.close()

    return root


def _build_family_contrasts(bundle: SnapshotBundle) -> list[FamilyContrast]:
    contrasts: list[FamilyContrast] = []
    groups = family_groups_for_tags(bundle.experiment_tags)
    for family_slug, tags in groups.items():
        experiments = [bundle.experiments[tag] for tag in tags]
        if family_slug in {"a1_abstain_toggle", "b1_small_model_family"}:
            by_model: dict[str, dict[bool, str]] = {}
            for tag, experiment in zip(tags, experiments):
                by_model.setdefault(str(experiment["model_id"]), {})[bool(experiment["abstain_enabled"])] = tag
            for model_id, tag_map in sorted(by_model.items()):
                if False in tag_map and True in tag_map:
                    baseline_tag = tag_map[False]
                    variant_tag = tag_map[True]
                    contrasts.append(
                        FamilyContrast(
                            contrast_id=f"{family_slug}:{baseline_tag}__vs__{variant_tag}",
                            family_slug=family_slug,
                            contrast_kind="abstain_toggle",
                            baseline_tag=baseline_tag,
                            variant_tag=variant_tag,
                            baseline_label=f"{model_id} abstain_off",
                            variant_label=f"{model_id} abstain_on",
                        )
                    )
            continue

        if len(tags) == 2:
            ordered = sorted(tags)
            baseline_tag, variant_tag = ordered
            kind = "swap_pair" if family_slug == "a4_model_swap" else "model_comparison"
            contrasts.append(
                FamilyContrast(
                    contrast_id=f"{family_slug}:{baseline_tag}__vs__{variant_tag}",
                    family_slug=family_slug,
                    contrast_kind=kind,
                    baseline_tag=baseline_tag,
                    variant_tag=variant_tag,
                    baseline_label=str(bundle.experiments[baseline_tag]["model_id"]),
                    variant_label=str(bundle.experiments[variant_tag]["model_id"]),
                )
                )

    def add_pair(
        *,
        family_slug: str,
        contrast_kind: str,
        baseline_tag: str,
        variant_tag: str,
        baseline_label: str,
        variant_label: str,
        match_mode: str = "strict",
    ) -> None:
        if baseline_tag not in bundle.experiment_tags or variant_tag not in bundle.experiment_tags:
            return
        contrasts.append(
            FamilyContrast(
                contrast_id=f"{family_slug}:{baseline_tag}__vs__{variant_tag}",
                family_slug=family_slug,
                contrast_kind=contrast_kind,
                baseline_tag=baseline_tag,
                variant_tag=variant_tag,
                baseline_label=baseline_label,
                variant_label=variant_label,
                match_mode=match_mode,
            )
        )

    def tag_model_fragment(model_id: str) -> str:
        return model_id.replace(".", "_").replace("-", "_")

    for model_id in ["gpt-4.1", "gpt-5.2"]:
        short = model_id
        fragment = tag_model_fragment(model_id)
        add_pair(
            family_slug="c1_bundle_strategy",
            contrast_kind="bundle_strategy",
            baseline_tag=f"v3_1_c1_{fragment}_bundle_5_random_l2",
            variant_tag=f"v3_1_c2_{fragment}_bundle_5_cluster_l2_v2",
            baseline_label=f"{short} random_bundle_5",
            variant_label=f"{short} semantic_cluster_5",
            match_mode="window_only",
        )
        add_pair(
            family_slug="c2_l3_projection",
            contrast_kind="evidence_projection",
            baseline_tag=f"v3_1_c2_{fragment}_bundle_5_cluster_l2_v2",
            variant_tag=f"v3_1_c3_{fragment}_bundle_5_cluster_l3_v2",
            baseline_label=f"{short} clustered l2",
            variant_label=f"{short} clustered l3_projected",
        )
        add_pair(
            family_slug="c6_scale_probe",
            contrast_kind="scale_probe",
            baseline_tag=f"v3_1_c2_{fragment}_bundle_5_cluster_l2_v2",
            variant_tag=f"v3_1_c6_{fragment}_bundle_5_cluster_l2_scale_7",
            baseline_label=f"{short} clustered scale_4",
            variant_label=f"{short} clustered scale_7",
        )
        add_pair(
            family_slug="c7_scale_probe",
            contrast_kind="scale_probe",
            baseline_tag=f"v3_1_c2_{fragment}_bundle_5_cluster_l2_v2",
            variant_tag=f"v3_1_c7_{fragment}_bundle_5_cluster_l2_scale_9",
            baseline_label=f"{short} clustered scale_4",
            variant_label=f"{short} clustered scale_9",
        )
        add_pair(
            family_slug="c7_scale_probe_step",
            contrast_kind="scale_probe_step",
            baseline_tag=f"v3_1_c6_{fragment}_bundle_5_cluster_l2_scale_7",
            variant_tag=f"v3_1_c7_{fragment}_bundle_5_cluster_l2_scale_9",
            baseline_label=f"{short} clustered scale_7",
            variant_label=f"{short} clustered scale_9",
        )

    add_pair(
        family_slug="c4_small_model_scale",
        contrast_kind="scale_size",
        baseline_tag="v3_b1_gpt_4_1_mini_abstain_true",
        variant_tag="v3_1_c4_gpt_4_1_mini_scale_5",
        baseline_label="gpt-4.1-mini scale_4",
        variant_label="gpt-4.1-mini scale_5",
    )
    add_pair(
        family_slug="c4_small_model_scale",
        contrast_kind="scale_size",
        baseline_tag="v3_b1_gpt_5_2_chat_abstain_true",
        variant_tag="v3_1_c4_gpt_5_2_chat_scale_5",
        baseline_label="gpt-5.2-chat scale_4",
        variant_label="gpt-5.2-chat scale_5",
    )

    return sorted(contrasts, key=lambda contrast: contrast.contrast_id)


def _build_family_contrasts_from_registry(contract_artifacts) -> list[FamilyContrast]:
    return sorted(
        [
            FamilyContrast(
                contrast_id=contrast.contrast_id,
                family_slug=contrast.family_slug,
                contrast_kind=contrast.contrast_kind,
                baseline_tag=contrast.baseline_tag,
                variant_tag=contrast.variant_tag,
                baseline_label=str(contrast.payload.get("baselineLabel", contrast.baseline_tag)),
                variant_label=str(contrast.payload.get("variantLabel", contrast.variant_tag)),
                match_mode="window_only"
                if "window/bundle-size" in str(contrast.payload.get("notes", "")).lower()
                else "strict",
            )
            for contrast in contract_artifacts.contrast_registry.contrasts
            if not contrast.family_slug.startswith("scale_size")
        ],
        key=lambda contrast: contrast.contrast_id,
    )


def _build_scale_size_contrasts_from_registry(contract_artifacts) -> list[FamilyContrast]:
    scale_family_slugs = {"scale_size_analysis", "c4_small_model_scale", "c6_scale_probe", "c7_scale_probe", "c7_scale_probe_step"}
    return sorted(
        [
            FamilyContrast(
                contrast_id=contrast.contrast_id,
                family_slug=contrast.family_slug,
                contrast_kind=contrast.contrast_kind,
                baseline_tag=contrast.baseline_tag,
                variant_tag=contrast.variant_tag,
                baseline_label=str(contrast.payload.get("baselineLabel", contrast.baseline_tag)),
                variant_label=str(contrast.payload.get("variantLabel", contrast.variant_tag)),
                match_mode="strict",
            )
            for contrast in contract_artifacts.contrast_registry.contrasts
            if contrast.family_slug in scale_family_slugs
        ],
        key=lambda contrast: contrast.contrast_id,
    )


def _build_scale_size_contrasts(bundle: SnapshotBundle) -> list[FamilyContrast]:
    contrasts: list[FamilyContrast] = []
    explicit_pairs = [
        ("v3_a1_gpt_4_1_abstain_true", "v3_a3_gpt_4_1_scale_5"),
        ("v3_a1_gpt_5_2_abstain_true", "v3_a3_gpt_5_2_scale_5"),
        ("v3_b1_gpt_4_1_mini_abstain_true", "v3_1_c4_gpt_4_1_mini_scale_5"),
        ("v3_b1_gpt_5_2_chat_abstain_true", "v3_1_c4_gpt_5_2_chat_scale_5"),
    ]
    for baseline_tag, variant_tag in explicit_pairs:
        if baseline_tag not in bundle.experiment_tags or variant_tag not in bundle.experiment_tags:
            continue
        baseline_scale = int(bundle.experiments[baseline_tag].get("scale_size", 0) or 0)
        variant_scale = int(bundle.experiments[variant_tag].get("scale_size", 0) or 0)
        model_id = str(bundle.experiments[baseline_tag].get("model_id"))
        contrasts.append(
            FamilyContrast(
                contrast_id=f"scale_size:{baseline_tag}__vs__{variant_tag}",
                family_slug="scale_size_analysis",
                contrast_kind="scale_size",
                baseline_tag=baseline_tag,
                variant_tag=variant_tag,
                baseline_label=f"{model_id} scale_{baseline_scale}",
                variant_label=f"{model_id} scale_{variant_scale}",
            )
        )
    return sorted(contrasts, key=lambda contrast: contrast.contrast_id)


def _build_sample_metrics(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    responses["family_slug"] = responses["experiment_tag"].apply(family_slug_from_tag)
    responses["expected_stage"] = responses["decoded_scores"].apply(_expected_stage)
    responses["is_singleton"] = responses["decoded_scores"].apply(lambda scores: len(scores) == 1)

    sample_rows: list[dict[str, object]] = []
    for (tag, sample_ordinal), group in responses.groupby(["experiment_tag", "sample_ordinal"], dropna=False):
        experiment = bundle.experiments[tag]
        non_abstain = group[~group["abstained"]]
        sample_id = str(group["sample_id"].iloc[0])
        bundle_signature = _signature(group["bundle_signature"].astype(str).tolist())
        window_signature = _signature(_flatten(group["window_ids"]))
        scale_size = int(experiment["scale_size"])
        stage_distribution = _mean_stage_distribution(non_abstain["decoded_scores"], scale_size)
        sample_rows.append(
            {
                "experiment_tag": tag,
                "family_slug": family_slug_from_tag(tag),
                "model_id": experiment["model_id"],
                "sample_ordinal": int(sample_ordinal),
                "sample_id": sample_id,
                "response_rows": int(len(group)),
                "unique_bundle_count": int(group["bundle_signature"].nunique()),
                "bundle_signature": bundle_signature,
                "window_signature": window_signature,
                "bundle_size_signature": _signature(group["bundle_size"].astype(str).tolist()),
                "abstain_rate": float(group["abstained"].mean()),
                "abstain_count": int(group["abstained"].sum()),
                "singleton_rate": _safe_mean(non_abstain["is_singleton"]),
                "mean_subset_size": _safe_mean(non_abstain["subset_size"]),
                "mean_expected_stage": _safe_mean(non_abstain["expected_stage"]),
                "mid_scale_mass": _mid_scale_mass(stage_distribution),
                "stage_entropy": _normalized_stage_entropy(stage_distribution),
                "mean_score_expert_agreement_prob": _safe_mean(group["score_expert_agreement_prob"]),
                "mean_rubric_observability_score": _safe_mean(group["rubric_observability_score"]),
                "mean_rubric_discriminability_score": _safe_mean(group["rubric_discriminability_score"]),
            }
        )

    sample_metrics = pd.DataFrame(sample_rows)
    tbm = _build_belief_frame(bundle, closed_world=False)
    closed = _build_belief_frame(bundle, closed_world=True)
    if not tbm.empty:
        tbm = tbm.rename(
            columns={
                "tag": "experiment_tag",
                "conflict": "tbm_conflict",
            }
        )
        tbm["tbm_expected_stage"] = tbm.apply(_belief_expected_stage, axis=1)
        sample_metrics = sample_metrics.merge(
            tbm[["experiment_tag", "sample_ordinal", "tbm_conflict", "tbm_expected_stage"]],
            on=["experiment_tag", "sample_ordinal"],
            how="left",
        )
    else:
        sample_metrics["tbm_conflict"] = np.nan
        sample_metrics["tbm_expected_stage"] = np.nan

    if not closed.empty:
        closed = closed.rename(
            columns={
                "tag": "experiment_tag",
                "conflict": "closed_world_conflict",
            }
        )
        closed["closed_world_expected_stage"] = closed.apply(_belief_expected_stage, axis=1)
        sample_metrics = sample_metrics.merge(
            closed[["experiment_tag", "sample_ordinal", "closed_world_conflict", "closed_world_expected_stage"]],
            on=["experiment_tag", "sample_ordinal"],
            how="left",
        )
    else:
        sample_metrics["closed_world_conflict"] = np.nan
        sample_metrics["closed_world_expected_stage"] = np.nan

    return sample_metrics.sort_values(["family_slug", "experiment_tag", "sample_ordinal"]).reset_index(drop=True)


def _build_experiment_geometry(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    global_stage_labels = list(range(1, int(pd.to_numeric(responses["scale_size"], errors="coerce").max()) + 1))
    rows: list[dict[str, object]] = []

    for tag, group in responses.groupby("experiment_tag", dropna=False):
        experiment_stage_labels = list(range(1, int(pd.to_numeric(group["scale_size"], errors="coerce").max()) + 1))
        stage_masses = {f"mass_stage_{stage}": 0.0 for stage in global_stage_labels}
        abstain_mass = 0.0
        response_count = int(len(group))
        if response_count == 0:
            continue

        for row in group.itertuples():
            decoded_scores = list(row.decoded_scores)
            if bool(row.abstained) or not decoded_scores:
                abstain_mass += 1.0
                continue
            weight = 1.0 / len(decoded_scores)
            for stage in decoded_scores:
                stage_masses[f"mass_stage_{int(stage)}"] += weight

        abstain_mass /= response_count
        for key in list(stage_masses):
            stage_masses[key] /= response_count

        stage_distribution = np.array([stage_masses[f"mass_stage_{stage}"] for stage in experiment_stage_labels], dtype=float)
        positive = stage_distribution[stage_distribution > 0]
        if len(positive) == 0:
            stage_entropy = 0.0
        else:
            stage_entropy = float(-(positive * np.log2(positive)).sum() / np.log2(len(experiment_stage_labels)))

        if len(experiment_stage_labels) <= 2:
            mid_scale_mass = 0.0
        else:
            mid_scale_mass = float(sum(stage_masses[f"mass_stage_{stage}"] for stage in experiment_stage_labels[1:-1]))

        rows.append(
            {
                "experiment_tag": tag,
                "family_slug": family_slug_from_tag(tag),
                "abstain_mass": float(abstain_mass),
                **stage_masses,
                "mid_scale_mass": mid_scale_mass,
                "stage_entropy": stage_entropy,
            }
        )

    return pd.DataFrame(rows).sort_values(["family_slug", "experiment_tag"]).reset_index(drop=True)


def _build_evidence_metrics(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    responses["family_slug"] = responses["experiment_tag"].apply(family_slug_from_tag)
    responses["expected_stage"] = responses["decoded_scores"].apply(_expected_stage)
    responses["is_singleton"] = responses["decoded_scores"].apply(lambda scores: len(scores) == 1)

    rows: list[dict[str, object]] = []
    for (tag, sample_ordinal, bundle_signature), group in responses.groupby(
        ["experiment_tag", "sample_ordinal", "bundle_signature"],
        dropna=False,
    ):
        non_abstain = group[~group["abstained"]]
        rows.append(
            {
                "experiment_tag": tag,
                "family_slug": family_slug_from_tag(tag),
                "sample_ordinal": int(sample_ordinal),
                "bundle_label": str(group["bundle_label"].iloc[0]),
                "bundle_signature": bundle_signature,
                "response_rows": int(len(group)),
                "bundle_size": int(group["bundle_size"].iloc[0]),
                "window_signature": _signature(_flatten(group["window_ids"])),
                "abstain_rate": float(group["abstained"].mean()),
                "singleton_rate": _safe_mean(non_abstain["is_singleton"]),
                "mean_subset_size": _safe_mean(non_abstain["subset_size"]),
                "mean_expected_stage": _safe_mean(non_abstain["expected_stage"]),
                "mean_score_expert_agreement_prob": _safe_mean(group["score_expert_agreement_prob"]),
            }
        )
    return pd.DataFrame(rows).sort_values(
        ["family_slug", "experiment_tag", "sample_ordinal", "bundle_signature"],
    ).reset_index(drop=True)


def _bundle_group_metadata(bundle: SnapshotBundle) -> pd.DataFrame:
    if not bundle.response_items.empty:
        rows: list[dict[str, object]] = []
        grouped = bundle.response_items.groupby(
            ["experiment_tag", "bundle_signature"],
            dropna=False,
        )
        for (experiment_tag, bundle_signature), group in grouped:
            labels = (
                group.sort_values(["position", "evidence_label"])
                ["evidence_label"]
                .dropna()
                .astype(str)
                .tolist()
            )
            bundle_size = int(group["bundle_size"].dropna().iloc[0]) if group["bundle_size"].notna().any() else len(labels)
            cluster_values = [str(value) for value in group["cluster_id"].dropna().unique().tolist() if str(value).strip()]
            cluster_id = cluster_values[0] if cluster_values else ""
            order_key = _bundle_sort_key(labels)
            short = labels[0] if bundle_size <= 1 and labels else str(bundle_signature)
            if bundle_size <= 1:
                display_label = short
            else:
                prefix = f"C{cluster_id}" if cluster_id else f"B{len(rows) + 1}"
                display_label = f"{prefix}: {' + '.join(labels[:5])}"
                if len(labels) > 5:
                    display_label += " + ..."
            rows.append(
                {
                    "experiment_tag": str(experiment_tag),
                    "bundle_signature": str(bundle_signature),
                    "bundle_group_label": _wrap_label(display_label),
                    "bundle_group_short": short,
                    "bundle_size": bundle_size,
                    "cluster_id": cluster_id or None,
                    "bundle_order_key": json.dumps(order_key),
                }
            )
        if rows:
            frame = pd.DataFrame(rows)
            frame["bundle_order"] = (
                frame.sort_values(["experiment_tag", "bundle_order_key", "bundle_group_label"])
                .groupby("experiment_tag")
                .cumcount()
                + 1
            )
            return frame.sort_values(["experiment_tag", "bundle_order"]).reset_index(drop=True)

    fallback = (
        bundle.responses[["experiment_tag", "bundle_signature", "bundle_label", "bundle_size", "cluster_id"]]
        .drop_duplicates()
        .copy()
    )
    if fallback.empty:
        return pd.DataFrame()
    fallback["bundle_group_label"] = fallback["bundle_label"].astype(str).apply(_wrap_label)
    fallback["bundle_group_short"] = fallback["bundle_label"].astype(str)
    fallback["bundle_order_key"] = fallback["bundle_label"].astype(str).apply(
        lambda value: json.dumps(_bundle_sort_key([chunk.strip() for chunk in value.split("|")])),
    )
    fallback["bundle_order"] = (
        fallback.sort_values(["experiment_tag", "bundle_order_key", "bundle_group_label"])
        .groupby("experiment_tag")
        .cumcount()
        + 1
    )
    return fallback.sort_values(["experiment_tag", "bundle_order"]).reset_index(drop=True)


def _build_bundle_verdict_profiles(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    if responses.empty:
        return pd.DataFrame()
    metadata = _bundle_group_metadata(bundle)
    experiment_meta = pd.DataFrame(
        [
            {
                "experiment_tag": tag,
                "model_id_meta": experiment["model_id"],
                "scale_size_meta": int(experiment["scale_size"]),
            }
            for tag, experiment in bundle.experiments.items()
        ]
    )
    responses["family_slug"] = responses["experiment_tag"].apply(family_slug_from_tag)
    responses["verdict_label"] = responses.apply(_verdict_label, axis=1)
    responses = responses.merge(
        metadata,
        on=["experiment_tag", "bundle_signature"],
        how="left",
    )
    responses = responses.merge(experiment_meta, on="experiment_tag", how="left")
    if "model_id" not in responses.columns:
        responses["model_id"] = responses["model_id_meta"]
    else:
        responses["model_id"] = responses["model_id"].fillna(responses["model_id_meta"])
    if "scale_size" not in responses.columns:
        responses["scale_size"] = responses["scale_size_meta"]
    else:
        responses["scale_size"] = (
            pd.to_numeric(responses["scale_size"], errors="coerce")
            .fillna(pd.to_numeric(responses["scale_size_meta"], errors="coerce"))
        )
    if "bundle_size" not in responses.columns:
        if "evidence_ids" in responses.columns:
            responses["bundle_size"] = responses["evidence_ids"].apply(lambda values: len(values) if isinstance(values, list) else 1)
        else:
            responses["bundle_size"] = 1
    else:
        responses["bundle_size"] = pd.to_numeric(responses["bundle_size"], errors="coerce").fillna(1).astype(int)
    if "cluster_id" not in responses.columns:
        responses["cluster_id"] = None
    if "bundle_group_label" not in responses.columns:
        source = responses["bundle_label"] if "bundle_label" in responses.columns else responses["bundle_signature"]
        responses["bundle_group_label"] = source.astype(str).apply(_wrap_label)
    if "bundle_group_short" not in responses.columns:
        source = responses["bundle_label"] if "bundle_label" in responses.columns else responses["bundle_signature"]
        responses["bundle_group_short"] = source.astype(str)
    if "bundle_order" not in responses.columns:
        responses["bundle_order"] = (
            responses.groupby(["experiment_tag", "bundle_signature"], dropna=False).ngroup() + 1
        )
    totals = responses.groupby(
        ["experiment_tag", "bundle_signature"],
        dropna=False,
    ).size().rename("bundle_total")
    grouped = (
        responses.groupby(
            [
                "experiment_tag",
                "family_slug",
                "model_id",
                "scale_size",
                "bundle_signature",
                "bundle_group_label",
                "bundle_group_short",
                "bundle_order",
                "bundle_size",
                "cluster_id",
                "verdict_label",
            ],
            dropna=False,
        )
        .agg(
            response_count=("response_id", "count"),
            mean_score_expert_agreement_prob=("score_expert_agreement_prob", "mean"),
        )
        .reset_index()
    )
    grouped = grouped.merge(
        totals.reset_index(),
        on=["experiment_tag", "bundle_signature"],
        how="left",
    )
    grouped["proportion"] = grouped["response_count"] / grouped["bundle_total"]
    return grouped.sort_values(
        ["family_slug", "experiment_tag", "bundle_order", "verdict_label"],
    ).reset_index(drop=True)


def _build_bundle_belief_profiles(bundle: SnapshotBundle, *, closed_world: bool) -> pd.DataFrame:
    responses = bundle.responses.copy()
    if responses.empty:
        return pd.DataFrame()
    metadata = _bundle_group_metadata(bundle)
    experiment_meta = pd.DataFrame(
        [
            {
                "experiment_tag": tag,
                "model_id_meta": experiment["model_id"],
                "scale_size_meta": int(experiment["scale_size"]),
            }
            for tag, experiment in bundle.experiments.items()
        ]
    )
    responses["family_slug"] = responses["experiment_tag"].apply(family_slug_from_tag)
    responses = responses.merge(
        metadata,
        on=["experiment_tag", "bundle_signature"],
        how="left",
    )
    responses = responses.merge(experiment_meta, on="experiment_tag", how="left")
    if "model_id" not in responses.columns:
        responses["model_id"] = responses["model_id_meta"]
    else:
        responses["model_id"] = responses["model_id"].fillna(responses["model_id_meta"])
    if "scale_size" not in responses.columns:
        responses["scale_size"] = responses["scale_size_meta"]
    else:
        responses["scale_size"] = (
            pd.to_numeric(responses["scale_size"], errors="coerce")
            .fillna(pd.to_numeric(responses["scale_size_meta"], errors="coerce"))
        )
    if "bundle_size" not in responses.columns:
        if "evidence_ids" in responses.columns:
            responses["bundle_size"] = responses["evidence_ids"].apply(lambda values: len(values) if isinstance(values, list) else 1)
        else:
            responses["bundle_size"] = 1
    else:
        responses["bundle_size"] = pd.to_numeric(responses["bundle_size"], errors="coerce").fillna(1).astype(int)
    if "cluster_id" not in responses.columns:
        responses["cluster_id"] = None
    if "bundle_group_label" not in responses.columns:
        source = responses["bundle_label"] if "bundle_label" in responses.columns else responses["bundle_signature"]
        responses["bundle_group_label"] = source.astype(str).apply(_wrap_label)
    if "bundle_group_short" not in responses.columns:
        source = responses["bundle_label"] if "bundle_label" in responses.columns else responses["bundle_signature"]
        responses["bundle_group_short"] = source.astype(str)
    if "bundle_order" not in responses.columns:
        responses["bundle_order"] = (
            responses.groupby(["experiment_tag", "bundle_signature"], dropna=False).ngroup() + 1
        )

    rows: list[dict[str, object]] = []
    for (experiment_tag, bundle_signature), group in responses.groupby(
        ["experiment_tag", "bundle_signature"],
        dropna=False,
    ):
        scale_size = int(pd.to_numeric(group["scale_size"], errors="coerce").max())
        if scale_size <= 0:
            continue
        theta = frozenset(range(1, scale_size + 1))
        stage_masses: dict[int, list[tuple[float, float]]] = {stage: [] for stage in range(1, scale_size + 1)}
        included = 0
        for row in group.itertuples():
            mass = _response_to_mass(pd.Series(row._asdict()), theta, closed_world=closed_world)
            if mass is None:
                continue
            pign = mass.pignistic()
            weight = (
                float(getattr(row, "rubric_observability_score", 1.0) or 1.0)
                * float(getattr(row, "rubric_discriminability_score", 1.0) or 1.0)
            )
            if not math.isfinite(weight) or weight <= 0:
                weight = 1.0
            included += 1
            for stage in range(1, scale_size + 1):
                stage_masses[stage].append((float(pign.get(frozenset([stage]), 0.0)), weight))

        if included == 0:
            continue
        exemplar = group.iloc[0]
        for stage in range(1, scale_size + 1):
            values = np.array([value for value, _ in stage_masses[stage]], dtype=float)
            weights = np.array([weight for _, weight in stage_masses[stage]], dtype=float)
            if len(values) == 0:
                mean_betp = float("nan")
            elif np.nansum(weights) <= 0:
                mean_betp = float(np.nanmean(values))
            else:
                mean_betp = float(np.average(values, weights=weights))
            rows.append(
                {
                    "method": "closed_world" if closed_world else "tbm",
                    "experiment_tag": str(experiment_tag),
                    "family_slug": str(exemplar["family_slug"]),
                    "model_id": str(exemplar["model_id"]),
                    "scale_size": scale_size,
                    "bundle_signature": str(bundle_signature),
                    "bundle_group_label": str(exemplar["bundle_group_label"]),
                    "bundle_group_short": str(exemplar["bundle_group_short"]),
                    "bundle_order": int(exemplar["bundle_order"]),
                    "bundle_size": int(exemplar["bundle_size"]),
                    "cluster_id": exemplar["cluster_id"],
                    "stage": stage,
                    "mean_betP": mean_betp,
                    "n_responses": included,
                }
            )
    return pd.DataFrame(rows).sort_values(
        ["family_slug", "experiment_tag", "bundle_order", "stage"],
    ).reset_index(drop=True)


def _verdict_label(row: pd.Series) -> str:
    if bool(row["abstained"]) or not row["decoded_scores"]:
        return "ABSTAIN"
    stages = sorted({int(stage) for stage in row["decoded_scores"]})
    return "[" + ",".join(str(stage) for stage in stages) + "]"


def _verdict_sort_key(verdict: str) -> tuple[int, int, str]:
    if verdict == "ABSTAIN":
        return (99, 99, verdict)
    stages = [int(value) for value in re.findall(r"\d+", verdict)]
    if not stages:
        return (98, 98, verdict)
    return (len(stages), stages[0], verdict)


def _bundle_sort_key(labels: list[str]) -> tuple[int, list[int], list[str]]:
    ints: list[int] = []
    for label in labels:
        match = re.search(r"(\d+)", str(label))
        if match:
            ints.append(int(match.group(1)))
    return (len(labels), ints or [9999], [str(label) for label in labels])


def _wrap_label(label: str, *, width: int = 26) -> str:
    return "\n".join(textwrap.wrap(str(label), width=width, break_long_words=False)) or str(label)


def _comparison_groups(experiment_metrics: pd.DataFrame) -> list[tuple[tuple[int, int], pd.DataFrame]]:
    if experiment_metrics.empty:
        return []
    frame = experiment_metrics.copy()
    frame["scale_size_int"] = pd.to_numeric(frame["scale_size"], errors="coerce").fillna(0).astype(int)
    frame["bundle_size_int"] = pd.to_numeric(frame["evidence_bundle_size"], errors="coerce").fillna(0).astype(int)
    groups: list[tuple[tuple[int, int], pd.DataFrame]] = []
    for key, group in frame.groupby(["scale_size_int", "bundle_size_int"], dropna=False):
        ordered = group.sort_values(["family_slug", "model_id", "experiment_tag"]).reset_index(drop=True)
        groups.append(((int(key[0]), int(key[1])), ordered))
    return sorted(groups, key=lambda item: item[0])


def _build_rubric_experiment_similarity(rubric_embeddings: pd.DataFrame) -> pd.DataFrame:
    if rubric_embeddings.empty:
        return pd.DataFrame()
    vectors_by_experiment: dict[str, np.ndarray] = {}
    for experiment_tag, group in rubric_embeddings.groupby("experiment_tag", dropna=False):
        vectors = np.vstack(group["vector_json"].apply(vector_from_json).tolist())
        centroid = vectors.mean(axis=0)
        norm = float(np.linalg.norm(centroid))
        if norm > 0:
            centroid = centroid / norm
        vectors_by_experiment[str(experiment_tag)] = centroid

    rows: list[dict[str, object]] = []
    tags = sorted(vectors_by_experiment)
    for left in tags:
        for right in tags:
            rows.append(
                {
                    "experiment_a": left,
                    "experiment_b": right,
                    "cosine_similarity": float(np.dot(vectors_by_experiment[left], vectors_by_experiment[right])),
                }
            )
    return pd.DataFrame(rows).sort_values(["experiment_a", "experiment_b"]).reset_index(drop=True)


def _build_rubric_contrast_similarity(
    *,
    rubric_embeddings: pd.DataFrame,
    contrasts: list[FamilyContrast],
    matching_details: pd.DataFrame,
) -> pd.DataFrame:
    if rubric_embeddings.empty or matching_details.empty:
        return pd.DataFrame()
    index = rubric_embeddings.set_index(["experiment_tag", "sample_ordinal"])
    rows: list[dict[str, object]] = []
    for contrast in contrasts:
        detail = matching_details[
            (matching_details["contrast_id"] == contrast.contrast_id)
            & (matching_details["comparable_sample"])
        ]
        cosine_values: list[float] = []
        for _, match_row in detail.iterrows():
            ordinal = int(match_row["sample_ordinal"])
            try:
                left = index.loc[(contrast.baseline_tag, ordinal)]
                right = index.loc[(contrast.variant_tag, ordinal)]
            except KeyError:
                continue
            left_vec = vector_from_json(str(left["vector_json"]))
            right_vec = vector_from_json(str(right["vector_json"]))
            cosine = float(np.dot(left_vec, right_vec))
            cosine_values.append(cosine)
            rows.append(
                {
                    "contrast_id": contrast.contrast_id,
                    "family_slug": contrast.family_slug,
                    "sample_ordinal": ordinal,
                    "baseline_tag": contrast.baseline_tag,
                    "variant_tag": contrast.variant_tag,
                    "cosine_similarity": cosine,
                }
            )

        if cosine_values:
            rows.append(
                {
                    "contrast_id": contrast.contrast_id,
                    "family_slug": contrast.family_slug,
                    "sample_ordinal": -1,
                    "baseline_tag": contrast.baseline_tag,
                    "variant_tag": contrast.variant_tag,
                    "cosine_similarity": float(np.mean(cosine_values)),
                }
            )

    result = pd.DataFrame(rows)
    if result.empty:
        return result
    return result.sort_values(["contrast_id", "sample_ordinal"]).reset_index(drop=True)


def _build_rubric_stage_contrast_similarity(
    *,
    rubric_stage_embeddings: pd.DataFrame,
    contrasts: list[FamilyContrast],
    matching_details: pd.DataFrame,
) -> pd.DataFrame:
    if rubric_stage_embeddings.empty or matching_details.empty:
        return pd.DataFrame()
    index = rubric_stage_embeddings.set_index(["experiment_tag", "sample_ordinal", "stage_number"])
    rows: list[dict[str, object]] = []
    for contrast in contrasts:
        detail = matching_details[
            (matching_details["contrast_id"] == contrast.contrast_id)
            & (matching_details["comparable_sample"])
        ]
        values_by_stage: dict[int, list[float]] = {}
        for _, match_row in detail.iterrows():
            ordinal = int(match_row["sample_ordinal"])
            for stage_number in sorted(rubric_stage_embeddings["stage_number"].dropna().unique().tolist()):
                key_left = (contrast.baseline_tag, ordinal, int(stage_number))
                key_right = (contrast.variant_tag, ordinal, int(stage_number))
                if key_left not in index.index or key_right not in index.index:
                    continue
                left = index.loc[key_left]
                right = index.loc[key_right]
                left_vec = vector_from_json(str(left["vector_json"]))
                right_vec = vector_from_json(str(right["vector_json"]))
                cosine = float(np.dot(left_vec, right_vec))
                values_by_stage.setdefault(int(stage_number), []).append(cosine)
                rows.append(
                    {
                        "contrast_id": contrast.contrast_id,
                        "family_slug": contrast.family_slug,
                        "sample_ordinal": ordinal,
                        "stage_number": int(stage_number),
                        "cosine_similarity": cosine,
                    }
                )
        for stage_number, values in sorted(values_by_stage.items()):
            rows.append(
                {
                    "contrast_id": contrast.contrast_id,
                    "family_slug": contrast.family_slug,
                    "sample_ordinal": -1,
                    "stage_number": stage_number,
                    "cosine_similarity": float(np.mean(values)),
                }
            )
    result = pd.DataFrame(rows)
    if result.empty:
        return result
    return result.sort_values(["contrast_id", "stage_number", "sample_ordinal"]).reset_index(drop=True)


def _build_rubric_experiment_clusters(rubric_experiment_similarity: pd.DataFrame) -> pd.DataFrame:
    if rubric_experiment_similarity.empty:
        return pd.DataFrame()
    similarity = rubric_experiment_similarity.pivot(
        index="experiment_a",
        columns="experiment_b",
        values="cosine_similarity",
    ).sort_index(axis=0).sort_index(axis=1)
    if similarity.empty:
        return pd.DataFrame()
    if len(similarity.index) == 1:
        return pd.DataFrame(
            [
                {
                    "experiment_tag": similarity.index[0],
                    "cluster_id": 1,
                    "cluster_order": 0,
                }
            ],
        )

    distance = (1.0 - similarity).clip(lower=0.0)
    distance_matrix = distance.to_numpy(copy=True)
    np.fill_diagonal(distance_matrix, 0.0)
    condensed = squareform(distance_matrix, checks=False)
    tree = linkage(condensed, method="average")
    order = leaves_list(tree).tolist()
    cluster_count = min(4, len(similarity.index))
    cluster_ids = fcluster(tree, t=cluster_count, criterion="maxclust")
    display_map: dict[str, str] = {}
    if "display_label_a" in rubric_experiment_similarity.columns:
        display_map.update(
            rubric_experiment_similarity[["experiment_a", "display_label_a"]]
            .drop_duplicates()
            .set_index("experiment_a")["display_label_a"]
            .to_dict()
        )
    if "display_label_b" in rubric_experiment_similarity.columns:
        display_map.update(
            rubric_experiment_similarity[["experiment_b", "display_label_b"]]
            .drop_duplicates()
            .set_index("experiment_b")["display_label_b"]
            .to_dict()
        )
    rows: list[dict[str, object]] = []
    for idx, experiment_tag in enumerate(similarity.index):
        rows.append(
            {
                "experiment_tag": experiment_tag,
                "display_label": display_map.get(experiment_tag, experiment_tag),
                "cluster_id": int(cluster_ids[idx]),
                "cluster_order": int(order.index(idx)),
            }
        )
    return pd.DataFrame(rows).sort_values(["cluster_id", "cluster_order"]).reset_index(drop=True)


def _build_rubric_focus_similarity(
    *,
    rubric_experiment_similarity: pd.DataFrame,
    bundle: SnapshotBundle,
) -> pd.DataFrame:
    if rubric_experiment_similarity.empty:
        return pd.DataFrame()
    focus_tags = {
        experiment_tag
        for experiment_tag, experiment in bundle.experiments.items()
        if str(experiment.get("model_id", "")) in RUBRIC_FOCUS_MODELS
    }
    if not focus_tags:
        return pd.DataFrame()
    filtered = rubric_experiment_similarity[
        rubric_experiment_similarity["experiment_a"].isin(focus_tags)
        & rubric_experiment_similarity["experiment_b"].isin(focus_tags)
    ].copy()
    if filtered.empty:
        return filtered
    metadata = []
    for experiment_tag in sorted(focus_tags):
        experiment = bundle.experiments.get(experiment_tag, {})
        metadata.append(
            {
                "experiment_tag": experiment_tag,
                "model_id": str(experiment.get("model_id", "")),
                "family_slug": family_slug_from_tag(experiment_tag),
                "display_label": _focused_rubric_label(bundle, experiment_tag),
            }
        )
    metadata_frame = pd.DataFrame(metadata)
    filtered = filtered.merge(
        metadata_frame.rename(
            columns={
                "experiment_tag": "experiment_a",
                "model_id": "model_a",
                "family_slug": "family_a",
                "display_label": "display_label_a",
            },
        ),
        on="experiment_a",
        how="left",
    )
    filtered = filtered.merge(
        metadata_frame.rename(
            columns={
                "experiment_tag": "experiment_b",
                "model_id": "model_b",
                "family_slug": "family_b",
                "display_label": "display_label_b",
            },
        ),
        on="experiment_b",
        how="left",
    )
    return filtered.sort_values(["model_a", "experiment_a", "model_b", "experiment_b"]).reset_index(drop=True)


def _focused_rubric_label(bundle: SnapshotBundle, experiment_tag: str) -> str:
    experiment = bundle.experiments.get(experiment_tag, {})
    model_short = _short_model_label(str(experiment.get("model_id", "")))
    parts = experiment_tag.split("_")
    family_code = parts[2] if len(parts) > 2 and parts[0] == "v3" and parts[1] == "1" else parts[1]
    suffix = ""
    if "abstain_true" in experiment_tag:
        suffix = "A+"
    elif "abstain_false" in experiment_tag:
        suffix = "A-"
    elif "illiberal_democracy" in experiment_tag:
        suffix = "illib"
    elif "control" in experiment_tag:
        suffix = "ctl"
    elif "cluster_l3" in experiment_tag:
        suffix = "cl3"
    elif "cluster_l2" in experiment_tag:
        suffix = "cl2"
    elif "random_l2" in experiment_tag:
        suffix = "rand"
    elif "scale_9" in experiment_tag:
        suffix = "s9"
    elif "scale_7" in experiment_tag:
        suffix = "s7"
    elif "scale_5" in experiment_tag:
        suffix = "s5"
    elif experiment.get("evidence_view") == "l3_abstracted":
        suffix = "l3"
    if suffix:
        return f"{family_code}|{model_short}|{suffix}"
    return f"{family_code}|{model_short}"


def _short_model_label(model_id: str) -> str:
    mapping = {
        "gpt-4.1": "4.1",
        "gpt-5.2": "5.2",
        "gpt-4.1-mini": "4.1m",
        "gpt-5.2-chat": "5.2c",
    }
    return mapping.get(model_id, model_id)


def _build_scale_certainty_analysis(
    *,
    bundle: SnapshotBundle,
    sample_metrics: pd.DataFrame,
    matching_details: pd.DataFrame,
    contrasts: list[FamilyContrast],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if sample_metrics.empty or matching_details.empty or not contrasts:
        return pd.DataFrame(), pd.DataFrame()

    effect_rows: list[dict[str, object]] = []
    sample_index = sample_metrics.set_index(["experiment_tag", "sample_ordinal"])
    rng = np.random.default_rng(7)
    endpoints = [
        "mean_score_expert_agreement_prob",
        "abstain_rate",
        "mean_subset_size",
        "mean_expected_stage",
    ]
    for contrast in contrasts:
        detail = matching_details[
            (matching_details["contrast_id"] == contrast.contrast_id)
            & (matching_details["comparable_sample"])
        ]
        if detail.empty:
            continue
        for endpoint in endpoints:
            deltas: list[float] = []
            for _, match_row in detail.iterrows():
                ordinal = int(match_row["sample_ordinal"])
                baseline = sample_index.loc[(contrast.baseline_tag, ordinal)]
                variant = sample_index.loc[(contrast.variant_tag, ordinal)]
                delta = _delta(
                    baseline.get(endpoint, np.nan),
                    variant.get(endpoint, np.nan),
                )
                if not math.isnan(delta):
                    deltas.append(delta)
            if not deltas:
                continue
            values = np.array(deltas, dtype=float)
            ci_low, ci_high = _bootstrap_ci(values, rng)
            effect_rows.append(
                {
                    "contrast_id": contrast.contrast_id,
                    "baseline_tag": contrast.baseline_tag,
                    "variant_tag": contrast.variant_tag,
                    "baseline_label": contrast.baseline_label,
                    "variant_label": contrast.variant_label,
                    "model_id": bundle.experiments[contrast.baseline_tag]["model_id"],
                    "baseline_scale_size": int(bundle.experiments[contrast.baseline_tag]["scale_size"]),
                    "variant_scale_size": int(bundle.experiments[contrast.variant_tag]["scale_size"]),
                    "endpoint": endpoint,
                    "n_samples": int(len(values)),
                    "mean_delta": float(values.mean()),
                    "median_delta": float(np.median(values)),
                    "ci_low": ci_low,
                    "ci_high": ci_high,
                    "effect_size_dz": _effect_size(values),
                    "sign_flip_pvalue": _sign_flip_pvalue(values, rng),
                }
            )

    regression = pd.DataFrame()
    responses = bundle.responses.copy()
    if not responses.empty:
        comparable_tags = sorted({contrast.baseline_tag for contrast in contrasts} | {contrast.variant_tag for contrast in contrasts})
        regression_input = responses[responses["experiment_tag"].isin(comparable_tags)].copy()
        if not regression_input.empty:
            regression_input["score_expert_agreement_prob"] = pd.to_numeric(
                regression_input["score_expert_agreement_prob"],
                errors="coerce",
            )
            regression_input["scale_size"] = pd.to_numeric(regression_input["scale_size"], errors="coerce")
            regression_input["model_id"] = regression_input["model"]
            regression_input = regression_input.dropna(subset=["score_expert_agreement_prob", "scale_size"])
            if not regression_input.empty:
                fit = smf.ols(
                    "score_expert_agreement_prob ~ scale_size + C(model_id) + C(sample_ordinal)",
                    data=regression_input,
                ).fit()
                regression = pd.DataFrame(
                    {
                        "term": fit.params.index,
                        "coef": fit.params.values,
                        "stderr": fit.bse.values,
                        "pvalue": fit.pvalues.values,
                        "conf_low": fit.conf_int()[0].values,
                        "conf_high": fit.conf_int()[1].values,
                        "r_squared": fit.rsquared,
                        "n_obs": int(fit.nobs),
                    }
                )

    return (
        pd.DataFrame(effect_rows).sort_values(["endpoint", "contrast_id"]).reset_index(drop=True)
        if effect_rows
        else pd.DataFrame(),
        regression,
    )


def _build_matching_tables(
    bundle: SnapshotBundle,
    contrasts: list[FamilyContrast],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    sample_metrics = _build_sample_metrics(bundle)
    detail_rows: list[dict[str, object]] = []
    summary_rows: list[dict[str, object]] = []

    for contrast in contrasts:
        baseline = sample_metrics[sample_metrics["experiment_tag"] == contrast.baseline_tag].set_index("sample_ordinal")
        variant = sample_metrics[sample_metrics["experiment_tag"] == contrast.variant_tag].set_index("sample_ordinal")
        ordinals = sorted(set(baseline.index) | set(variant.index))
        matched_rows = 0
        all_checks = []
        for ordinal in ordinals:
            left = baseline.loc[ordinal] if ordinal in baseline.index else None
            right = variant.loc[ordinal] if ordinal in variant.index else None
            present_both = left is not None and right is not None
            bundle_match = present_both and left["bundle_signature"] == right["bundle_signature"]
            window_match = present_both and left["window_signature"] == right["window_signature"]
            bundle_size_match = present_both and left["bundle_size_signature"] == right["bundle_size_signature"]
            response_rows_match = present_both and int(left["response_rows"]) == int(right["response_rows"])
            if contrast.match_mode == "window_only":
                comparable = bool(window_match and bundle_size_match and response_rows_match)
            else:
                comparable = bool(bundle_match and window_match and bundle_size_match)
            if comparable:
                matched_rows += 1
            all_checks.append(comparable)
            detail_rows.append(
                {
                    "contrast_id": contrast.contrast_id,
                    "family_slug": contrast.family_slug,
                    "baseline_tag": contrast.baseline_tag,
                    "variant_tag": contrast.variant_tag,
                    "sample_ordinal": int(ordinal),
                    "baseline_present": left is not None,
                    "variant_present": right is not None,
                    "baseline_sample_id": None if left is None else left["sample_id"],
                    "variant_sample_id": None if right is None else right["sample_id"],
                    "baseline_response_rows": None if left is None else int(left["response_rows"]),
                    "variant_response_rows": None if right is None else int(right["response_rows"]),
                    "bundle_signature_match": bool(bundle_match),
                    "window_signature_match": bool(window_match),
                    "bundle_size_signature_match": bool(bundle_size_match),
                    "response_rows_match": bool(response_rows_match),
                    "match_mode": contrast.match_mode,
                    "comparable_sample": comparable,
                }
            )

        summary_rows.append(
            {
                "contrast_id": contrast.contrast_id,
                "family_slug": contrast.family_slug,
                "contrast_kind": contrast.contrast_kind,
                "baseline_tag": contrast.baseline_tag,
                "variant_tag": contrast.variant_tag,
                "baseline_label": contrast.baseline_label,
                "variant_label": contrast.variant_label,
                "baseline_sample_count": int(len(baseline)),
                "variant_sample_count": int(len(variant)),
                "matched_sample_count": int(matched_rows),
                "fully_matched": bool(all(all_checks) and len(baseline) == len(variant) == matched_rows),
                "notes": _matching_note(
                    checks=all_checks,
                    baseline_count=len(baseline),
                    variant_count=len(variant),
                    matched_rows=matched_rows,
                    match_mode=contrast.match_mode,
                ),
            }
        )

    detail_frame = pd.DataFrame(detail_rows)
    summary_frame = pd.DataFrame(summary_rows)
    if not detail_frame.empty:
        detail_frame = detail_frame.sort_values(["contrast_id", "sample_ordinal"]).reset_index(drop=True)
    if not summary_frame.empty:
        summary_frame = summary_frame.sort_values("contrast_id").reset_index(drop=True)
    return detail_frame, summary_frame


def _build_family_pair_deltas(
    sample_metrics: pd.DataFrame,
    matching_details: pd.DataFrame,
    contrasts: list[FamilyContrast],
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    sample_index = sample_metrics.set_index(["experiment_tag", "sample_ordinal"])
    endpoints = PRIMARY_ENDPOINTS + SECONDARY_ENDPOINTS + [
        "tbm_expected_stage",
        "closed_world_expected_stage",
    ]

    for contrast in contrasts:
        detail = matching_details[
            (matching_details["contrast_id"] == contrast.contrast_id)
            & (matching_details["comparable_sample"])
        ]
        for _, match_row in detail.iterrows():
            ordinal = int(match_row["sample_ordinal"])
            baseline = sample_index.loc[(contrast.baseline_tag, ordinal)]
            variant = sample_index.loc[(contrast.variant_tag, ordinal)]
            row: dict[str, object] = {
                "contrast_id": contrast.contrast_id,
                "family_slug": contrast.family_slug,
                "contrast_kind": contrast.contrast_kind,
                "baseline_tag": contrast.baseline_tag,
                "variant_tag": contrast.variant_tag,
                "baseline_label": contrast.baseline_label,
                "variant_label": contrast.variant_label,
                "sample_ordinal": ordinal,
            }
            for endpoint in endpoints:
                row[f"{endpoint}_baseline"] = baseline.get(endpoint, np.nan)
                row[f"{endpoint}_variant"] = variant.get(endpoint, np.nan)
                row[f"{endpoint}_delta"] = _delta(
                    baseline.get(endpoint, np.nan),
                    variant.get(endpoint, np.nan),
                )
            rows.append(row)

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values(["family_slug", "contrast_id", "sample_ordinal"]).reset_index(drop=True)


def _build_family_effects(family_pair_deltas: pd.DataFrame) -> pd.DataFrame:
    if family_pair_deltas.empty:
        return pd.DataFrame()

    rows: list[dict[str, object]] = []
    rng = np.random.default_rng(0)
    delta_columns = [column for column in family_pair_deltas.columns if column.endswith("_delta")]
    for (contrast_id, family_slug, contrast_kind, baseline_tag, variant_tag), group in family_pair_deltas.groupby(
        ["contrast_id", "family_slug", "contrast_kind", "baseline_tag", "variant_tag"],
        dropna=False,
    ):
        for column in delta_columns:
            values = group[column].dropna().to_numpy(dtype=float)
            if len(values) == 0:
                continue
            endpoint = column.removesuffix("_delta")
            ci_low, ci_high = _bootstrap_ci(values, rng)
            rows.append(
                {
                    "contrast_id": contrast_id,
                    "family_slug": family_slug,
                    "contrast_kind": contrast_kind,
                    "baseline_tag": baseline_tag,
                    "variant_tag": variant_tag,
                    "endpoint": endpoint,
                    "n_samples": int(len(values)),
                    "mean_delta": float(values.mean()),
                    "median_delta": float(np.median(values)),
                    "std_delta": float(values.std(ddof=1)) if len(values) > 1 else 0.0,
                    "effect_size_dz": _effect_size(values),
                    "positive_share": float((values > 0).mean()),
                    "ci_low": ci_low,
                    "ci_high": ci_high,
                    "sign_flip_pvalue": _sign_flip_pvalue(values, rng),
                }
            )

    return pd.DataFrame(rows).sort_values(
        ["family_slug", "contrast_id", "endpoint"],
    ).reset_index(drop=True)


def _build_family_effects_qvalues(family_effects: pd.DataFrame) -> pd.DataFrame:
    if family_effects.empty:
        return pd.DataFrame()
    subset = family_effects[family_effects["endpoint"].isin(PRIMARY_ENDPOINTS)].copy()
    if subset.empty:
        return pd.DataFrame()

    rows: list[dict[str, object]] = []
    for family_slug, group in subset.groupby("family_slug", dropna=False):
        qvalues = _benjamini_hochberg(group["sign_flip_pvalue"].astype(float).to_numpy())
        ordered = group.reset_index(drop=True).copy()
        ordered["qvalue"] = qvalues
        ordered["is_significant_fdr_10"] = ordered["qvalue"] <= 0.10
        ordered["is_significant_fdr_05"] = ordered["qvalue"] <= 0.05
        rows.extend(ordered.to_dict(orient="records"))
    return pd.DataFrame(rows).sort_values(["family_slug", "contrast_id", "endpoint"]).reset_index(drop=True)


def _build_verdict_geometry_certainty(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    if responses.empty:
        return pd.DataFrame()
    responses["family_slug"] = responses["experiment_tag"].apply(family_slug_from_tag)
    responses["verdict_label"] = responses.apply(_verdict_label, axis=1)
    responses["geometry_bucket"] = responses.apply(
        lambda row: _verdict_geometry_bucket(
            decoded_scores=row["decoded_scores"],
            abstained=bool(row["abstained"]),
        ),
        axis=1,
    )
    rows = (
        responses.groupby(
            ["experiment_tag", "family_slug", "model", "scale_size", "verdict_label", "geometry_bucket"],
            dropna=False,
        )
        .agg(
            response_count=("response_id", "count"),
            mean_score_expert_agreement_prob=("score_expert_agreement_prob", "mean"),
            mean_subset_size=("subset_size", "mean"),
            abstain_rate=("abstained", "mean"),
        )
        .reset_index()
        .rename(columns={"model": "model_id"})
    )
    totals = rows.groupby("experiment_tag", dropna=False)["response_count"].transform("sum")
    rows["response_share"] = rows["response_count"] / totals
    return rows.sort_values(
        ["family_slug", "experiment_tag", "geometry_bucket", "verdict_label"],
    ).reset_index(drop=True)


def _build_bundle_policy_deltas(family_effects: pd.DataFrame) -> pd.DataFrame:
    if family_effects.empty:
        return pd.DataFrame()
    families = {
        "c1_bundle_strategy",
        "c2_l3_projection",
        "scale_size_analysis",
        "c4_small_model_scale",
        "c6_scale_probe",
        "c7_scale_probe",
        "c7_scale_probe_step",
    }
    rows = family_effects[
        family_effects["family_slug"].isin(families)
        & family_effects["endpoint"].isin(PRIMARY_ENDPOINTS + SECONDARY_ENDPOINTS)
    ].copy()
    if rows.empty:
        return pd.DataFrame()
    rows["policy_family"] = rows["family_slug"]
    return rows.sort_values(["policy_family", "contrast_id", "endpoint"]).reset_index(drop=True)


def _build_robust_summary_panel(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    if responses.empty:
        return pd.DataFrame()
    responses["family_slug"] = responses["experiment_tag"].apply(family_slug_from_tag)
    responses["expected_stage"] = responses["decoded_scores"].apply(_expected_stage)
    non_abstain = responses[~responses["abstained"]].copy()

    rows: list[dict[str, object]] = []
    for tag, group in responses.groupby("experiment_tag", dropna=False):
        group_non_abstain = non_abstain[non_abstain["experiment_tag"] == tag]
        experiment = bundle.experiments[tag]
        rows.append(
            {
                "experiment_tag": tag,
                "family_slug": family_slug_from_tag(tag),
                "model_id": experiment["model_id"],
                "scale_size": int(experiment["scale_size"]),
                "bundle_size": int(experiment.get("evidence_bundle_size") or 1),
                "abstain_rate": float(group["abstained"].mean()),
                "subset_size_median": _safe_quantile(group_non_abstain["subset_size"], 0.5),
                "subset_size_iqr": _safe_iqr(group_non_abstain["subset_size"]),
                "expected_stage_median": _safe_quantile(group_non_abstain["expected_stage"], 0.5),
                "expected_stage_iqr": _safe_iqr(group_non_abstain["expected_stage"]),
                "certainty_median": _safe_quantile(group["score_expert_agreement_prob"], 0.5),
                "certainty_iqr": _safe_iqr(group["score_expert_agreement_prob"]),
                "subset_size_trimmed_mean": _trimmed_mean(group_non_abstain["subset_size"]),
                "expected_stage_trimmed_mean": _trimmed_mean(group_non_abstain["expected_stage"]),
                "certainty_trimmed_mean": _trimmed_mean(group["score_expert_agreement_prob"]),
            }
        )
    return pd.DataFrame(rows).sort_values(["family_slug", "experiment_tag"]).reset_index(drop=True)


def _build_contrast_registry_frame(contrasts: list[FamilyContrast]) -> pd.DataFrame:
    if not contrasts:
        return pd.DataFrame()
    return pd.DataFrame(
        [
            {
                "contrast_id": contrast.contrast_id,
                "family_slug": contrast.family_slug,
                "contrast_kind": contrast.contrast_kind,
                "baseline_tag": contrast.baseline_tag,
                "variant_tag": contrast.variant_tag,
                "baseline_label": contrast.baseline_label,
                "variant_label": contrast.variant_label,
                "match_mode": contrast.match_mode,
            }
            for contrast in contrasts
        ]
    ).sort_values(["family_slug", "contrast_id"]).reset_index(drop=True)


def _build_sample_instability(sample_metrics: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for sample_ordinal, group in sample_metrics.groupby("sample_ordinal", dropna=False):
        metrics = {
            "sample_ordinal": int(sample_ordinal),
            "experiment_count": int(group["experiment_tag"].nunique()),
            "abstain_rate_std": _safe_std(group["abstain_rate"]),
            "singleton_rate_std": _safe_std(group["singleton_rate"]),
            "mean_subset_size_std": _safe_std(group["mean_subset_size"]),
            "mean_expected_stage_std": _safe_std(group["mean_expected_stage"]),
            "tbm_conflict_std": _safe_std(group["tbm_conflict"]),
            "closed_world_conflict_std": _safe_std(group["closed_world_conflict"]),
        }
        metrics["instability_score"] = float(
            np.nansum([
                metrics["abstain_rate_std"],
                metrics["singleton_rate_std"],
                metrics["mean_subset_size_std"],
                metrics["mean_expected_stage_std"],
            ])
        )
        rows.append(metrics)
    return pd.DataFrame(rows).sort_values("instability_score", ascending=False).reset_index(drop=True)


def _build_experiment_distances(experiment_metrics: pd.DataFrame) -> pd.DataFrame:
    if experiment_metrics.empty:
        return pd.DataFrame()
    metric_columns = [
        "abstain_rate",
        "singleton_rate",
        "mean_subset_size",
        "mean_score_expert_agreement_prob",
        "mean_tbm_conflict",
        "mean_closed_world_conflict",
    ]
    available = [column for column in metric_columns if column in experiment_metrics.columns]
    frame = experiment_metrics[["experiment_tag", *available]].copy().set_index("experiment_tag")
    frame = frame.astype(float)
    frame = frame.fillna(frame.mean()).fillna(0.0)
    std = frame.std(ddof=0).replace(0, 1.0)
    standardized = (frame - frame.mean()) / std

    rows: list[dict[str, object]] = []
    index = list(standardized.index)
    for idx, left_tag in enumerate(index):
        for right_tag in index[idx + 1:]:
            delta = standardized.loc[left_tag] - standardized.loc[right_tag]
            rows.append(
                {
                    "experiment_a": left_tag,
                    "experiment_b": right_tag,
                    "distance": float(np.sqrt(np.square(delta).sum())),
                }
            )
    return pd.DataFrame(rows).sort_values("distance", ascending=False).reset_index(drop=True)


def _build_candidate_findings(
    *,
    experiment_metrics: pd.DataFrame,
    experiment_geometry: pd.DataFrame,
    family_effects: pd.DataFrame,
    rubric_contrast_similarity: pd.DataFrame,
    scale_certainty_effects: pd.DataFrame,
    sample_instability: pd.DataFrame,
) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    if not family_effects.empty:
        primary = family_effects[
            family_effects["endpoint"].isin(PRIMARY_ENDPOINTS)
        ].copy()
        primary["strength"] = primary["mean_delta"].abs()
        for row in primary.sort_values("strength", ascending=False).head(12).itertuples():
            rows.append(
                {
                    "finding_kind": "family_effect",
                    "subject": row.contrast_id,
                    "score": float(row.strength),
                    "summary": (
                        f"{row.contrast_id} shifts {row.endpoint} by {row.mean_delta:.3f} "
                        f"(95% CI {row.ci_low:.3f} to {row.ci_high:.3f}, n={row.n_samples})"
                    ),
                }
            )

    if not experiment_metrics.empty:
        metric_columns = [
            "abstain_rate",
            "singleton_rate",
            "mean_subset_size",
            "mean_tbm_conflict",
            "mean_closed_world_conflict",
        ]
        metrics = experiment_metrics[["experiment_tag", *metric_columns]].copy()
        for column in metric_columns:
            series = metrics[column].astype(float)
            std = float(series.std(ddof=0))
            if std == 0 or math.isnan(std):
                continue
            z_scores = (series - float(series.mean())) / std
            for experiment_tag, value, z_score in zip(metrics["experiment_tag"], series, z_scores, strict=False):
                if abs(float(z_score)) < 1.5:
                    continue
                direction = "high" if z_score > 0 else "low"
                rows.append(
                    {
                        "finding_kind": "experiment_outlier",
                        "subject": experiment_tag,
                        "score": abs(float(z_score)),
                        "summary": f"{experiment_tag} is {direction} on {column} ({value:.3f}, z={z_score:.2f})",
                    }
                )

    if not experiment_geometry.empty:
        for column, direction in [("mid_scale_mass", "low"), ("stage_entropy", "low")]:
            series = experiment_geometry[column].astype(float)
            std = float(series.std(ddof=0))
            if std == 0 or math.isnan(std):
                continue
            z_scores = (series - float(series.mean())) / std
            for experiment_tag, value, z_score in zip(experiment_geometry["experiment_tag"], series, z_scores, strict=False):
                if z_score > -1.5:
                    continue
                rows.append(
                    {
                        "finding_kind": "compression_outlier",
                        "subject": experiment_tag,
                        "score": abs(float(z_score)),
                        "summary": f"{experiment_tag} is {direction} on {column} ({value:.3f}, z={z_score:.2f})",
                    }
                )

    if not sample_instability.empty:
        for row in sample_instability.head(10).itertuples():
            rows.append(
                {
                    "finding_kind": "sample_instability",
                    "subject": f"S{row.sample_ordinal:02d}",
                    "score": float(row.instability_score),
                    "summary": (
                        f"S{row.sample_ordinal:02d} is highly unstable across experiments "
                        f"(score={row.instability_score:.3f}, abstain_std={row.abstain_rate_std:.3f}, "
                        f"subset_std={row.mean_subset_size_std:.3f})"
                    ),
                }
            )

    if not rubric_contrast_similarity.empty:
        contrast_means = rubric_contrast_similarity[rubric_contrast_similarity["sample_ordinal"] == -1].copy()
        for row in contrast_means.sort_values("cosine_similarity").head(8).itertuples():
            rows.append(
                {
                    "finding_kind": "rubric_divergence",
                    "subject": row.contrast_id,
                    "score": float(1.0 - row.cosine_similarity),
                    "summary": f"{row.contrast_id} has mean rubric cosine similarity {row.cosine_similarity:.3f}",
                }
            )

    if not scale_certainty_effects.empty:
        certainty = scale_certainty_effects[
            scale_certainty_effects["endpoint"] == "mean_score_expert_agreement_prob"
        ].copy()
        if not certainty.empty:
            certainty["strength"] = certainty["mean_delta"].abs()
            for row in certainty.sort_values("strength", ascending=False).head(4).itertuples():
                rows.append(
                    {
                        "finding_kind": "scale_certainty",
                        "subject": row.contrast_id,
                        "score": float(row.strength),
                        "summary": (
                            f"{row.contrast_id} shifts expert-agreement certainty by {row.mean_delta:.3f} "
                            f"(95% CI {row.ci_low:.3f} to {row.ci_high:.3f}, n={row.n_samples})"
                        ),
                    }
                )

    if not rows:
        return pd.DataFrame(columns=["finding_kind", "subject", "score", "summary"])
    return pd.DataFrame(rows).sort_values("score", ascending=False).reset_index(drop=True)


def _load_figure_repair_plan(figures_manifest_path: str | None) -> dict[str, tuple[str, ...]]:
    candidate = figures_manifest_path or "_blueprints/v3-analysis-process/figures_manifest.json"
    manifest_path = Path(candidate)
    if not manifest_path.exists():
        manifest_path = Path(__file__).resolve().parents[4] / candidate
    if not manifest_path.exists():
        return {}
    try:
        manifest = load_figure_manifest(manifest_path)
    except Exception:
        return {}
    raw_plan = build_repair_plan(manifest)
    return {
        figure_id: tuple(transforms)
        for figure_id, transforms in raw_plan.items()
    }


def _repair_enabled(
    plan: dict[str, tuple[str, ...]],
    figure_id: str,
    transform: str,
) -> bool:
    return transform in plan.get(figure_id, ())


def _short_contrast_label(contrast_id: str) -> str:
    family, _, pair = str(contrast_id).partition(":")
    left, _, right = pair.partition("__vs__")
    if not right:
        return family
    return f"{family}\n{left[-18:]} -> {right[-18:]}"


def _write_sample_metric_heatmaps(
    *,
    sample_merged: pd.DataFrame,
    comparison_groups: list[tuple[tuple[int, int], pd.DataFrame]],
    metric_column: str,
    title_prefix: str,
    cmap: str,
    vmin: float,
    vmax_by_scale: bool,
    output_path: Path,
    top_sample_ordinals: list[int],
    figure_repair_plan: dict[str, tuple[str, ...]],
    figure_id: str,
) -> list[Path]:
    paths: list[Path] = []
    panel_frames: list[tuple[str, pd.DataFrame, int]] = []
    use_unstable_subset = _repair_enabled(figure_repair_plan, figure_id, "restrict_to_top_unstable_samples")
    for (scale_size, bundle_size), group in comparison_groups:
        experiments = group["experiment_tag"].tolist()
        subset = sample_merged[sample_merged["experiment_tag"].isin(experiments)].copy()
        if use_unstable_subset and top_sample_ordinals:
            subset = subset[subset["sample_ordinal"].isin(top_sample_ordinals)]
        if subset.empty:
            continue
        for model_id, model_group in subset.groupby("model_id", dropna=False):
            order = [
                tag
                for tag in experiments
                if tag in model_group["experiment_tag"].tolist()
            ]
            if not order:
                continue
            for page in paginate_labels(order, page_size=8):
                pivot = (
                    model_group[model_group["experiment_tag"].isin(page)]
                    .pivot(index="sample_ordinal", columns="experiment_tag", values=metric_column)
                    .sort_index()
                    .reindex(columns=page)
                )
                if pivot.empty:
                    continue
                title = f"{title_prefix} | scale {scale_size}, bundle {bundle_size}, model {model_id}"
                panel_frames.append((title, pivot, int(scale_size)))
    if not panel_frames:
        return paths

    page_size = 4 if _repair_enabled(figure_repair_plan, figure_id, "facet_by_model_family") else len(panel_frames)
    panel_pages = paginate_labels(list(range(len(panel_frames))), page_size=page_size)
    for page_index, page in enumerate(panel_pages, start=1):
        page_panels = [panel_frames[index] for index in page]
        rows, cols = suggest_facet_grid(len(page_panels), max_columns=2)
        fig, axes = plt.subplots(
            rows,
            cols,
            figsize=(6.6 * cols, max(4.4, 3.8 * rows)),
            squeeze=False,
        )
        for ax, (title, pivot, scale_size) in zip(axes.flatten(), page_panels):
            vmax = max(1.0, float(scale_size)) if vmax_by_scale else 1.0
            sns.heatmap(
                pivot,
                cmap=cmap,
                ax=ax,
                vmin=vmin,
                vmax=vmax,
                cbar=True,
            )
            ax.set_title(title, fontsize=10)
            ax.set_xlabel("Experiment")
            ax.set_ylabel("Sample ordinal")
            ax.tick_params(axis="x", rotation=25, labelsize=8)
            ax.tick_params(axis="y", labelsize=8)
        for ax in axes.flatten()[len(page_panels):]:
            ax.set_visible(False)
        fig.tight_layout()
        page_path = output_path if page_index == 1 else output_path.with_name(f"{output_path.stem}_p{page_index}{output_path.suffix}")
        fig.savefig(page_path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        paths.append(page_path)
    return paths


def _write_figures(
    *,
    bundle: SnapshotBundle,
    experiment_geometry: pd.DataFrame,
    experiment_metrics: pd.DataFrame,
    family_effects: pd.DataFrame,
    rubric_experiment_similarity: pd.DataFrame,
    rubric_focus_similarity: pd.DataFrame,
    rubric_stage_contrast_similarity: pd.DataFrame,
    sample_instability: pd.DataFrame,
    sample_metrics: pd.DataFrame,
    scale_certainty_effects: pd.DataFrame,
    bundle_verdict_profiles: pd.DataFrame,
    bundle_belief_tbm: pd.DataFrame,
    bundle_belief_closed: pd.DataFrame,
    figures_dir: Path,
    figure_repair_plan: dict[str, tuple[str, ...]],
) -> list[Path]:
    paths: list[Path] = []
    comparison_groups = _comparison_groups(experiment_metrics)
    if not experiment_geometry.empty and comparison_groups:
        merged = experiment_geometry.merge(
            experiment_metrics[
                [
                    "experiment_tag",
                    "family_slug",
                    "model_id",
                    "scale_size",
                    "evidence_bundle_size",
                ]
            ],
            on="experiment_tag",
            how="left",
        )
        fig, axes = plt.subplots(
            len(comparison_groups),
            1,
            figsize=(12, max(4 * len(comparison_groups), 5)),
            squeeze=False,
        )
        for ax, ((scale_size, bundle_size), group) in zip(axes.flatten(), comparison_groups):
            subset = merged[merged["experiment_tag"].isin(group["experiment_tag"])].copy()
            stage_columns = [f"mass_stage_{stage}" for stage in range(1, scale_size + 1) if f"mass_stage_{stage}" in subset.columns]
            columns = ["abstain_mass", *stage_columns, "mid_scale_mass", "stage_entropy"]
            heatmap = (
                subset.set_index("experiment_tag")[columns]
                .astype(float)
                .reindex(group["experiment_tag"].tolist())
            )
            sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="rocket_r", ax=ax, vmin=0, vmax=1)
            ax.set_title(f"Adjudicative geometry | scale {scale_size}, bundle size {bundle_size}")
            ax.set_xlabel("Mass / summary")
            ax.set_ylabel("")
        fig.tight_layout()
        path = figures_dir / "experiment_adjudicative_heatmap.png"
        fig.savefig(path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        paths.append(path)

    if not rubric_experiment_similarity.empty:
        similarity = rubric_experiment_similarity.pivot(
            index="experiment_a",
            columns="experiment_b",
            values="cosine_similarity",
        )
        fig, ax = plt.subplots(figsize=(12, max(6, 0.4 * len(similarity.index))))
        sns.heatmap(similarity, annot=True, fmt=".2f", cmap="viridis", ax=ax, vmin=0, vmax=1)
        ax.set_title("Rubric centroid cosine similarity")
        ax.set_xlabel("Experiment")
        ax.set_ylabel("Experiment")
        fig.tight_layout()
        path = figures_dir / "rubric_similarity_heatmap.png"
        fig.savefig(path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        paths.append(path)

        if len(similarity.index) > 1:
            distance = (1.0 - similarity).clip(lower=0.0)
            distance_matrix = distance.to_numpy(copy=True)
            np.fill_diagonal(distance_matrix, 0.0)
            condensed = squareform(distance_matrix, checks=False)
            tree = linkage(condensed, method="average")
            fig, ax = plt.subplots(figsize=(12, max(6, 0.3 * len(similarity.index))))
            dendrogram(tree, labels=similarity.index.tolist(), orientation="right", ax=ax, leaf_font_size=8)
            ax.set_title("Rubric embedding clustering")
            ax.set_xlabel("Average-linkage distance")
            fig.tight_layout()
            path = figures_dir / "rubric_similarity_dendrogram.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

    if not rubric_focus_similarity.empty:
        similarity = rubric_focus_similarity.pivot(
            index="experiment_a",
            columns="experiment_b",
            values="cosine_similarity",
        )
        label_index = (
            rubric_focus_similarity[["experiment_a", "display_label_a"]]
            .drop_duplicates()
            .set_index("experiment_a")["display_label_a"]
            .to_dict()
        )
        if not similarity.empty:
            ordered_similarity = similarity.copy()
            ordered_labels = similarity.index.tolist()
            if len(similarity.index) > 1:
                distance = (1.0 - similarity).clip(lower=0.0)
                distance_matrix = distance.to_numpy(copy=True)
                np.fill_diagonal(distance_matrix, 0.0)
                condensed = squareform(distance_matrix, checks=False)
                tree = linkage(condensed, method="average")
                order = leaves_list(tree).tolist()
                labels = similarity.index.tolist()
                ordered_labels = [labels[index] for index in order]
                ordered_similarity = similarity.loc[ordered_labels, ordered_labels]

                fig, ax = plt.subplots(figsize=(14, max(7, 0.34 * len(similarity.index))))
                dendrogram(
                    tree,
                    labels=[label_index.get(label, label) for label in labels],
                    orientation="right",
                    ax=ax,
                    leaf_font_size=8,
                )
                ax.set_title("Rubric embedding clustering | GPT main + secondary models")
                ax.set_xlabel("Average-linkage distance")
                fig.tight_layout()
                path = figures_dir / "rubric_focus_dendrogram.png"
                fig.savefig(path, dpi=200, bbox_inches="tight")
                plt.close(fig)
                paths.append(path)

            display_matrix = ordered_similarity.copy()
            display_matrix.index = [label_index.get(label, label) for label in ordered_labels]
            display_matrix.columns = [label_index.get(label, label) for label in ordered_labels]
            fig, ax = plt.subplots(figsize=(16, max(10, 0.44 * len(display_matrix.index))))
            sns.heatmap(
                display_matrix,
                annot=False,
                cmap="viridis",
                ax=ax,
                vmin=0,
                vmax=1,
                square=True,
                cbar_kws={"shrink": 0.8, "label": "Cosine similarity"},
            )
            ax.set_title("Rubric centroid cosine similarity | GPT main + secondary models")
            ax.set_xlabel("Experiment")
            ax.set_ylabel("Experiment")
            ax.tick_params(axis="x", rotation=45, labelsize=7)
            ax.tick_params(axis="y", labelsize=7)
            fig.tight_layout()
            path = figures_dir / "rubric_focus_heatmap.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

    if not rubric_stage_contrast_similarity.empty:
        summary = rubric_stage_contrast_similarity[
            rubric_stage_contrast_similarity["sample_ordinal"] == -1
        ].copy()
        if not summary.empty:
            heatmap = summary.pivot(
                index="contrast_id",
                columns="stage_number",
                values="cosine_similarity",
            ).sort_index(axis=1)
            fig, ax = plt.subplots(figsize=(10, max(4, 0.5 * len(heatmap.index))))
            sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="mako", ax=ax, vmin=0, vmax=1)
            ax.set_title("Stage-level rubric similarity by contrast")
            ax.set_xlabel("Stage number")
            ax.set_ylabel("Contrast")
            fig.tight_layout()
            path = figures_dir / "rubric_stage_similarity_heatmap.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

    if not family_effects.empty:
        heatmap_endpoints = [
            "abstain_rate",
            "singleton_rate",
            "mean_subset_size",
            "mean_expected_stage",
        ]
        heatmap_df = family_effects[family_effects["endpoint"].isin(heatmap_endpoints)].copy()
        if not heatmap_df.empty:
            heatmap = heatmap_df.pivot(index="contrast_id", columns="endpoint", values="mean_delta")
            if _repair_enabled(figure_repair_plan, "family_effect_heatmap", "subset_to_top_contrasts"):
                score = heatmap.abs().max(axis=1).sort_values(ascending=False)
                heatmap = heatmap.reindex(score.head(10).index.tolist())
            heatmap.index = [_short_contrast_label(value) for value in heatmap.index]
            annotate = should_annotate_heatmap(
                row_count=len(heatmap.index),
                column_count=len(heatmap.columns),
                max_cells_for_annotations=40,
            )
            fig, ax = plt.subplots(figsize=(10.5, max(4.2, 0.48 * len(heatmap.index))))
            sns.heatmap(
                heatmap,
                annot=annotate,
                fmt=".2f",
                cmap="coolwarm",
                center=0,
                ax=ax,
            )
            ax.set_title("Family effect deltas (matched samples, top contrasts)")
            ax.set_ylabel("Contrast")
            fig.tight_layout()
            path = figures_dir / "family_effect_heatmap.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

            if _repair_enabled(figure_repair_plan, "family_effect_heatmap", "paginate_by_family"):
                family_pages_dir = figures_dir / "family_effect_heatmaps"
                family_pages_dir.mkdir(parents=True, exist_ok=True)
                for family_slug, group in heatmap_df.groupby("family_slug", dropna=False):
                    family_heatmap = (
                        group.pivot(index="contrast_id", columns="endpoint", values="mean_delta")
                        .reindex(columns=heatmap_endpoints)
                    )
                    family_heatmap.index = [_short_contrast_label(value) for value in family_heatmap.index]
                    if family_heatmap.empty:
                        continue
                    family_annotate = should_annotate_heatmap(
                        row_count=len(family_heatmap.index),
                        column_count=len(family_heatmap.columns),
                        max_cells_for_annotations=90,
                    )
                    fig, ax = plt.subplots(figsize=(9.0, max(3.5, 0.5 * len(family_heatmap.index))))
                    sns.heatmap(
                        family_heatmap,
                        annot=family_annotate,
                        fmt=".2f",
                        cmap="coolwarm",
                        center=0,
                        ax=ax,
                    )
                    ax.set_title(f"Family effects | {family_slug}")
                    ax.set_ylabel("Contrast")
                    fig.tight_layout()
                    page_path = family_pages_dir / f"{family_slug}_heatmap.png"
                    fig.savefig(page_path, dpi=200, bbox_inches="tight")
                    plt.close(fig)
                    paths.append(page_path)

        for endpoint in ["abstain_rate", "mean_subset_size"]:
            endpoint_df = family_effects[family_effects["endpoint"] == endpoint].copy()
            if endpoint_df.empty:
                continue
            endpoint_df = endpoint_df.sort_values("mean_delta")
            fig, ax = plt.subplots(figsize=(10, max(4, 0.6 * len(endpoint_df))))
            ax.errorbar(
                endpoint_df["mean_delta"],
                endpoint_df["contrast_id"],
                xerr=[
                    endpoint_df["mean_delta"] - endpoint_df["ci_low"],
                    endpoint_df["ci_high"] - endpoint_df["mean_delta"],
                ],
                fmt="o",
                color="#255f85",
                ecolor="#9bb8d3",
                capsize=4,
            )
            ax.axvline(0, color="black", linewidth=1)
            ax.set_title(f"Matched family effects: {endpoint}")
            ax.set_xlabel("Variant - baseline")
            ax.set_ylabel("Contrast")
            fig.tight_layout()
            path = figures_dir / f"family_effect_{endpoint}.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

    if not sample_instability.empty:
        top = sample_instability.head(12).copy().sort_values("instability_score")
        fig, ax = plt.subplots(figsize=(8, max(4, 0.45 * len(top))))
        sns.barplot(data=top, x="instability_score", y=top["sample_ordinal"].apply(lambda x: f"S{x:02d}"), ax=ax, color="#c46c43")
        ax.set_title("Most unstable samples across experiments")
        ax.set_xlabel("Instability score")
        ax.set_ylabel("Sample")
        fig.tight_layout()
        path = figures_dir / "sample_instability.png"
        fig.savefig(path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        paths.append(path)

    if not sample_metrics.empty and comparison_groups:
        sample_merged = sample_metrics.merge(
            experiment_metrics[
                [
                    "experiment_tag",
                    "scale_size",
                    "evidence_bundle_size",
                ]
            ],
            on="experiment_tag",
            how="left",
        )
        top_unstable_ordinals = sample_instability["sample_ordinal"].head(12).astype(int).tolist()
        expected_paths = _write_sample_metric_heatmaps(
            sample_merged=sample_merged,
            comparison_groups=comparison_groups,
            metric_column="mean_expected_stage",
            title_prefix="Sample-by-experiment expected stage",
            cmap="YlOrRd",
            vmin=1.0,
            vmax_by_scale=True,
            output_path=figures_dir / "sample_expected_stage_heatmap.png",
            top_sample_ordinals=top_unstable_ordinals,
            figure_repair_plan=figure_repair_plan,
            figure_id="sample_expected_stage_heatmap",
        )
        paths.extend(expected_paths)
        abstain_paths = _write_sample_metric_heatmaps(
            sample_merged=sample_merged,
            comparison_groups=comparison_groups,
            metric_column="abstain_rate",
            title_prefix="Sample-by-experiment abstain rate",
            cmap="Greys",
            vmin=0.0,
            vmax_by_scale=False,
            output_path=figures_dir / "sample_abstain_heatmap.png",
            top_sample_ordinals=top_unstable_ordinals,
            figure_repair_plan=figure_repair_plan,
            figure_id="sample_expected_stage_heatmap",
        )
        paths.extend(abstain_paths)

    if not scale_certainty_effects.empty:
        certainty = scale_certainty_effects[
            scale_certainty_effects["endpoint"] == "mean_score_expert_agreement_prob"
        ].copy()
        if not certainty.empty:
            certainty["label"] = certainty.apply(
                lambda row: f"{row.model_id}: {int(row.baseline_scale_size)}->{int(row.variant_scale_size)}",
                axis=1,
            )
            certainty = certainty.sort_values("mean_delta")
            fig, ax = plt.subplots(figsize=(10, max(4, 0.7 * len(certainty))))
            ax.errorbar(
                certainty["mean_delta"],
                certainty["label"],
                xerr=[
                    certainty["mean_delta"] - certainty["ci_low"],
                    certainty["ci_high"] - certainty["mean_delta"],
                ],
                fmt="o",
                color="#1f5a7a",
                ecolor="#8db3c7",
                capsize=4,
            )
            ax.axvline(0, color="black", linewidth=1)
            ax.set_title("Scale size vs expert-agreement certainty")
            ax.set_xlabel("Larger scale - smaller scale")
            ax.set_ylabel("Matched contrast")
            fig.tight_layout()
            path = figures_dir / "scale_certainty_effects.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

    family_verdict_dir = figures_dir / "family_verdict_heatmaps"
    family_belief_dir = figures_dir / "family_belief_heatmaps"
    family_verdict_dir.mkdir(parents=True, exist_ok=True)
    family_belief_dir.mkdir(parents=True, exist_ok=True)

    if not bundle_verdict_profiles.empty:
        paths.extend(
            _write_family_verdict_heatmaps(
                bundle=bundle,
                verdict_profiles=bundle_verdict_profiles,
                output_dir=family_verdict_dir,
                figure_repair_plan=figure_repair_plan,
            )
        )

    if not bundle_belief_tbm.empty or not bundle_belief_closed.empty:
        paths.extend(
            _write_family_belief_heatmaps(
                bundle=bundle,
                tbm_profiles=bundle_belief_tbm,
                closed_profiles=bundle_belief_closed,
                output_dir=family_belief_dir,
            )
        )

    curated_dir = figures_dir / "curated"
    curated_dir.mkdir(parents=True, exist_ok=True)
    paths.extend(
        _write_curated_figures(
            experiment_metrics=experiment_metrics,
            family_effects=family_effects,
            output_dir=curated_dir,
        )
    )

    return paths


def _write_family_verdict_heatmaps(
    *,
    bundle: SnapshotBundle,
    verdict_profiles: pd.DataFrame,
    output_dir: Path,
    figure_repair_plan: dict[str, tuple[str, ...]],
) -> list[Path]:
    paths: list[Path] = []
    geometry_order = [
        "abstain",
        "singleton",
        "adjacent_subset",
        "non_adjacent_subset",
        "broad_subset",
        "unknown",
    ]
    for family_slug, tags in family_groups_for_tags(bundle.experiment_tags).items():
        family_df = verdict_profiles[verdict_profiles["experiment_tag"].isin(tags)].copy()
        if family_df.empty:
            continue
        tag_order = _family_tag_order(bundle, tags)
        use_bucketed_geometry = (
            _repair_enabled(figure_repair_plan, "c7_scale_9_verdict_distribution", "bucket_verdicts_by_geometry")
            and (
                "scale_9" in family_slug
                or family_df["verdict_label"].dropna().nunique() > 8
                or any(int(bundle.experiments[tag]["scale_size"]) >= 7 for tag in tags)
            )
        )
        page_groups = paginate_labels(tag_order, page_size=4)
        for page_idx, page_tags in enumerate(page_groups, start=1):
            n_cols = min(2, max(1, len(page_tags)))
            n_rows = math.ceil(len(page_tags) / n_cols)
            fig, axes = plt.subplots(
                n_rows,
                n_cols,
                figsize=(8 * n_cols, max(4.6 * n_rows, 4.6)),
                squeeze=False,
            )
            for ax, tag in zip(axes.flatten(), page_tags):
                sub = family_df[family_df["experiment_tag"] == tag].copy()
                if sub.empty:
                    ax.set_visible(False)
                    continue
                row_order = (
                    sub[["bundle_group_label", "bundle_order"]]
                    .drop_duplicates()
                    .sort_values("bundle_order")["bundle_group_label"]
                    .tolist()
                )
                if use_bucketed_geometry:
                    sub = sub.assign(
                        geometry_bucket=sub["verdict_label"].astype(str).apply(bucket_verdict_label),
                    )
                    sub = (
                        sub.groupby(
                            ["bundle_group_label", "bundle_order", "geometry_bucket"],
                            dropna=False,
                        )
                        .agg(
                            response_count=("response_count", "sum"),
                            bundle_total=("bundle_total", "max"),
                            certainty_weighted=("mean_score_expert_agreement_prob", lambda values: float(np.nanmean(values))),
                        )
                        .reset_index()
                    )
                    sub["proportion"] = sub["response_count"] / sub["bundle_total"].replace(0, np.nan)
                    sub["mean_score_expert_agreement_prob"] = sub["certainty_weighted"]
                    column_order = [label for label in geometry_order if label in sub["geometry_bucket"].unique().tolist()]
                    pivot_column = "geometry_bucket"
                else:
                    column_order = sorted(sub["verdict_label"].dropna().unique().tolist(), key=_verdict_sort_key)
                    pivot_column = "verdict_label"
                proportion = sub.pivot(
                    index="bundle_group_label",
                    columns=pivot_column,
                    values="proportion",
                ).reindex(index=row_order, columns=column_order, fill_value=0.0)
                certainty = sub.pivot(
                    index="bundle_group_label",
                    columns=pivot_column,
                    values="mean_score_expert_agreement_prob",
                ).reindex(index=row_order, columns=column_order)
                annotate = should_annotate_heatmap(
                    row_count=len(proportion.index),
                    column_count=len(proportion.columns),
                    max_cells_for_annotations=40,
                )
                if annotate:
                    annot: bool | pd.DataFrame = proportion.copy().astype(object)
                    for row_label in proportion.index:
                        for column_label in proportion.columns:
                            value = float(proportion.loc[row_label, column_label])
                            if value <= 0:
                                annot.loc[row_label, column_label] = ""
                                continue
                            agreement = certainty.loc[row_label, column_label]
                            if pd.isna(agreement):
                                annot.loc[row_label, column_label] = f"{value:.2f}"
                            else:
                                annot.loc[row_label, column_label] = f"{value:.2f}\n({float(agreement):.2f})"
                else:
                    annot = False
                sns.heatmap(
                    proportion,
                    annot=annot,
                    fmt="",
                    cmap="YlOrRd",
                    vmin=0.0,
                    vmax=1.0,
                    ax=ax,
                    cbar=(tag == page_tags[-1]),
                    cbar_kws={"label": "Verdict proportion"} if tag == page_tags[-1] else None,
                )
                meta = bundle.experiments[tag]
                ax.set_title(
                    f"{meta['model_id']} | scale {int(meta['scale_size'])} | bundle {int(meta['evidence_bundle_size'])}",
                )
                ax.set_xlabel("Geometry bucket" if use_bucketed_geometry else "Verdict")
                ax.set_ylabel("Evidence group")
                ax.tick_params(axis="x", rotation=0 if use_bucketed_geometry else 25, labelsize=8)
                ax.tick_params(axis="y", labelsize=8)
            for ax in axes.flatten()[len(page_tags):]:
                ax.set_visible(False)
            subtitle = "geometry-bucketed" if use_bucketed_geometry else "raw verdicts"
            fig.suptitle(
                f"Verdict distribution per evidence group: {family_slug} ({subtitle})\ncell = proportion (avg expertAgreementProb)",
                y=1.02,
            )
            fig.tight_layout()
            if page_idx == 1:
                path = output_dir / f"{family_slug}_verdict_distribution.png"
            else:
                path = output_dir / f"{family_slug}_verdict_distribution_p{page_idx}.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            if use_bucketed_geometry and page_idx == 1:
                geometry_path = output_dir / f"{family_slug}_verdict_distribution_geometry_bucketed.png"
                fig.savefig(geometry_path, dpi=200, bbox_inches="tight")
                paths.append(geometry_path)
            plt.close(fig)
            paths.append(path)
    return paths


def _write_family_belief_heatmaps(
    *,
    bundle: SnapshotBundle,
    tbm_profiles: pd.DataFrame,
    closed_profiles: pd.DataFrame,
    output_dir: Path,
) -> list[Path]:
    paths: list[Path] = []
    for family_slug, tags in family_groups_for_tags(bundle.experiment_tags).items():
        tag_order = _family_tag_order(bundle, tags)
        for method_label, profiles in [("tbm", tbm_profiles), ("closed_world", closed_profiles)]:
            family_df = profiles[profiles["experiment_tag"].isin(tags)].copy()
            if family_df.empty:
                continue
            n_cols = min(2, max(1, len(tag_order)))
            n_rows = math.ceil(len(tag_order) / n_cols)
            fig, axes = plt.subplots(
                n_rows,
                n_cols,
                figsize=(8 * n_cols, max(4.5 * n_rows, 4.5)),
                squeeze=False,
            )
            for ax, tag in zip(axes.flatten(), tag_order):
                sub = family_df[family_df["experiment_tag"] == tag].copy()
                if sub.empty:
                    ax.set_visible(False)
                    continue
                row_order = (
                    sub[["bundle_group_label", "bundle_order"]]
                    .drop_duplicates()
                    .sort_values("bundle_order")["bundle_group_label"]
                    .tolist()
                )
                column_order = sorted(pd.to_numeric(sub["stage"], errors="coerce").dropna().astype(int).unique().tolist())
                pivot = sub.pivot(
                    index="bundle_group_label",
                    columns="stage",
                    values="mean_betP",
                ).reindex(index=row_order, columns=column_order)
                sns.heatmap(
                    pivot,
                    annot=True,
                    fmt=".2f",
                    cmap="viridis",
                    vmin=0.0,
                    vmax=1.0,
                    ax=ax,
                    cbar=(tag == tag_order[-1]),
                    cbar_kws={"label": "Weighted mean BetP"} if tag == tag_order[-1] else None,
                )
                meta = bundle.experiments[tag]
                ax.set_title(
                    f"{meta['model_id']} | scale {int(meta['scale_size'])} | bundle {int(meta['evidence_bundle_size'])}",
                )
                ax.set_xlabel("Stage")
                ax.set_ylabel("Evidence group")
            for ax in axes.flatten()[len(tag_order):]:
                ax.set_visible(False)
            method_title = "TBM" if method_label == "tbm" else "Closed-world"
            fig.suptitle(
                f"Final stage belief per evidence group: {family_slug} ({method_title})",
                y=1.02,
            )
            fig.tight_layout()
            path = output_dir / f"{family_slug}_{method_label}_belief.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)
    return paths


def _family_tag_order(bundle: SnapshotBundle, tags: list[str]) -> list[str]:
    def sort_key(tag: str) -> tuple[str, int, int, str]:
        meta = bundle.experiments[tag]
        return (
            str(meta["model_id"]),
            int(meta["scale_size"]),
            int(meta["evidence_bundle_size"]),
            tag,
        )
    return sorted(tags, key=sort_key)


def _write_curated_figures(
    *,
    experiment_metrics: pd.DataFrame,
    family_effects: pd.DataFrame,
    output_dir: Path,
) -> list[Path]:
    paths: list[Path] = []
    paths.extend(_write_contrast_hero_heatmap(family_effects, output_dir))
    paths.extend(_write_scale_probe_profile(experiment_metrics, output_dir))
    paths.extend(_write_bundle_strategy_profile(experiment_metrics, output_dir))
    return paths


def _write_contrast_hero_heatmap(family_effects: pd.DataFrame, output_dir: Path) -> list[Path]:
    if family_effects.empty:
        return []
    selected_contrasts = [
        "a1_abstain_toggle:v3_a1_gpt_5_2_abstain_false__vs__v3_a1_gpt_5_2_abstain_true",
        "a4_model_swap:v3_a4_rubric_gpt_4_1_scoring_gpt_5_2__vs__v3_a4_rubric_gpt_5_2_scoring_gpt_4_1",
        "a5_concept_swap:v3_a5_gpt_5_2_illiberal_democracy__vs__v3_a5_gpt_4_1_illiberal_democracy",
        "c1_bundle_strategy:v3_1_c1_gpt_5_2_bundle_5_random_l2__vs__v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2",
        "c6_scale_probe:v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2__vs__v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7",
        "c7_scale_probe_step:v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7__vs__v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9",
        "c4_small_model_scale:v3_b1_gpt_5_2_chat_abstain_true__vs__v3_1_c4_gpt_5_2_chat_scale_5",
    ]
    endpoint_order = [
        "abstain_rate",
        "mean_subset_size",
        "mean_expected_stage",
        "mean_score_expert_agreement_prob",
        "tbm_conflict",
        "closed_world_conflict",
    ]
    frame = family_effects[
        family_effects["contrast_id"].isin(selected_contrasts)
        & family_effects["endpoint"].isin(endpoint_order)
    ].copy()
    if frame.empty:
        return []
    contrast_labels = {
        selected_contrasts[0]: "a1 | gpt-5.2 abstain",
        selected_contrasts[1]: "a4 | model-role swap",
        selected_contrasts[2]: "a5 | concept framing",
        selected_contrasts[3]: "c1 | gpt-5.2 random->cluster",
        selected_contrasts[4]: "c6 | gpt-4.1 scale 4->7",
        selected_contrasts[5]: "c7 | gpt-5.2 scale 7->9",
        selected_contrasts[6]: "c4 | gpt-5.2-chat scale 4->5",
    }
    frame["contrast_label"] = frame["contrast_id"].map(contrast_labels)
    heatmap = frame.pivot(index="contrast_label", columns="endpoint", values="mean_delta")
    heatmap = heatmap.reindex(index=[contrast_labels[value] for value in selected_contrasts if value in contrast_labels], columns=endpoint_order)
    fig, ax = plt.subplots(figsize=(11, max(5, 0.65 * len(heatmap.index))))
    sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="coolwarm", center=0, ax=ax)
    ax.set_title("Key V3 / V3.1 intervention effects")
    ax.set_xlabel("Endpoint")
    ax.set_ylabel("")
    fig.tight_layout()
    path = output_dir / "hero_contrast_heatmap.png"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return [path]


def _write_scale_probe_profile(experiment_metrics: pd.DataFrame, output_dir: Path) -> list[Path]:
    wanted = [
        "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2",
        "v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7",
        "v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9",
        "v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2",
        "v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7",
        "v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9",
    ]
    frame = experiment_metrics[experiment_metrics["experiment_tag"].isin(wanted)].copy()
    if frame.empty:
        return []
    label_map = {
        "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2": ("gpt-4.1", 4),
        "v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7": ("gpt-4.1", 7),
        "v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9": ("gpt-4.1", 9),
        "v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2": ("gpt-5.2", 4),
        "v3_1_c6_gpt_5_2_bundle_5_cluster_l2_scale_7": ("gpt-5.2", 7),
        "v3_1_c7_gpt_5_2_bundle_5_cluster_l2_scale_9": ("gpt-5.2", 9),
    }
    frame["model"] = frame["experiment_tag"].map(lambda tag: label_map[tag][0])
    frame["scale"] = frame["experiment_tag"].map(lambda tag: label_map[tag][1])
    metrics = [
        ("mean_subset_size", "Mean subset size"),
        ("mean_score_expert_agreement_prob", "Expert-agreement certainty"),
        ("mean_tbm_conflict", "TBM conflict"),
        ("mean_closed_world_conflict", "Closed-world conflict"),
    ]
    fig, axes = plt.subplots(2, 2, figsize=(11, 8), squeeze=False)
    for ax, (metric, title) in zip(axes.flatten(), metrics):
        for model, group in frame.groupby("model"):
            group = group.sort_values("scale")
            ax.plot(group["scale"], pd.to_numeric(group[metric], errors="coerce"), marker="o", label=model)
        ax.set_title(title)
        ax.set_xlabel("Scale size")
        ax.grid(alpha=0.25)
    axes[0, 0].legend(frameon=False)
    fig.suptitle("Clustered high-scale probe profiles", y=1.01)
    fig.tight_layout()
    path = output_dir / "hero_scale_probe_profile.png"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return [path]


def _write_bundle_strategy_profile(experiment_metrics: pd.DataFrame, output_dir: Path) -> list[Path]:
    wanted = [
        "v3_1_c1_gpt_4_1_bundle_5_random_l2",
        "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2",
        "v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2",
        "v3_1_c1_gpt_5_2_bundle_5_random_l2",
        "v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2",
        "v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2",
    ]
    frame = experiment_metrics[experiment_metrics["experiment_tag"].isin(wanted)].copy()
    if frame.empty:
        return []
    order = [
        "v3_1_c1_gpt_4_1_bundle_5_random_l2",
        "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2",
        "v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2",
        "v3_1_c1_gpt_5_2_bundle_5_random_l2",
        "v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2",
        "v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2",
    ]
    label_map = {
        "v3_1_c1_gpt_4_1_bundle_5_random_l2": "gpt-4.1 | random l2",
        "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2": "gpt-4.1 | cluster l2",
        "v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2": "gpt-4.1 | cluster l3",
        "v3_1_c1_gpt_5_2_bundle_5_random_l2": "gpt-5.2 | random l2",
        "v3_1_c2_gpt_5_2_bundle_5_cluster_l2_v2": "gpt-5.2 | cluster l2",
        "v3_1_c3_gpt_5_2_bundle_5_cluster_l3_v2": "gpt-5.2 | cluster l3",
    }
    metrics = [
        "abstain_rate",
        "singleton_rate",
        "mean_subset_size",
        "mean_tbm_conflict",
    ]
    heatmap = (
        frame.assign(label=frame["experiment_tag"].map(label_map))
        .set_index("label")[metrics]
        .reindex([label_map[tag] for tag in order if tag in label_map])
        .astype(float)
    )
    fig, ax = plt.subplots(figsize=(10, 5))
    sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="mako", ax=ax)
    ax.set_title("Bundle-strategy regime comparison")
    ax.set_xlabel("Metric")
    ax.set_ylabel("")
    fig.tight_layout()
    path = output_dir / "hero_bundle_strategy_heatmap.png"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return [path]


def _build_markdown_report(
    *,
    bundle: SnapshotBundle,
    candidate_findings: pd.DataFrame,
    experiment_distances: pd.DataFrame,
    experiment_geometry: pd.DataFrame,
    experiment_metrics: pd.DataFrame,
    matching_validation: pd.DataFrame,
    family_effects: pd.DataFrame,
    rubric_contrast_similarity: pd.DataFrame,
    rubric_focus_similarity: pd.DataFrame,
    rubric_stage_contrast_similarity: pd.DataFrame,
    scale_matching_validation: pd.DataFrame,
    scale_certainty_effects: pd.DataFrame,
    scale_certainty_regression: pd.DataFrame,
    sample_instability: pd.DataFrame,
) -> str:
    matched = matching_validation[matching_validation["fully_matched"]] if not matching_validation.empty else pd.DataFrame()
    effect_summary = _top_effects_markdown(family_effects)
    instability_summary = _instability_markdown(sample_instability)
    finding_summary = _candidate_findings_markdown(candidate_findings)
    distance_summary = _distance_markdown(experiment_distances)
    headline_summary = _headline_findings_markdown(
        experiment_metrics=experiment_metrics,
        matching_validation=matching_validation,
        family_effects=family_effects,
    )
    matched_lines = "\n".join(
        f"- `{row.contrast_id}`: {row.matched_sample_count} matched samples"
        for row in matched.itertuples()
    ) or "- No fully matched contrasts yet."
    geometry_summary = _geometry_markdown(experiment_geometry)
    rubric_summary = _rubric_similarity_markdown(
        rubric_contrast_similarity,
        rubric_focus_similarity,
        rubric_stage_contrast_similarity,
    )
    scale_summary = _scale_certainty_markdown(
        scale_matching_validation=scale_matching_validation,
        scale_certainty_effects=scale_certainty_effects,
        scale_certainty_regression=scale_certainty_regression,
    )

    return f"""# V3 Investigation Report

This is the first execution-pass investigation over the cached V3 pilot data. It validates contrast matching, materializes derived tables, and computes matched family effects so later reporting can be driven by tables instead of manual chart browsing.

## Scope

- Experiments analyzed: {len(bundle.experiment_tags)}
- Families covered: {len(family_groups_for_tags(bundle.experiment_tags))}
- Primary unit for inference in this pass: matched `sample_ordinal`

## Matching Validation

Fully matched contrasts in this pass:
{matched_lines}

Reference tables:
- [matching_validation.csv](tables/matching_validation.csv)
- [matching_details.csv](tables/matching_details.csv)

## First-Pass Findings

{headline_summary}

## Ranked Signals

{finding_summary}

## Strongest Matched Family Effects

{effect_summary}

## Sample Instability

{instability_summary}

## Adjudicative Geometry

{geometry_summary}

## Rubric Similarity

{rubric_summary}

## Scale Size vs Certainty

{scale_summary}

## Experiment Similarity

{distance_summary}

Reference tables:
- [experiment_metrics.csv](tables/experiment_metrics.csv)
- [experiment_geometry.csv](tables/experiment_geometry.csv)
- [sample_metrics.csv](tables/sample_metrics.csv)
- [evidence_metrics.csv](tables/evidence_metrics.csv)
- [family_pair_deltas.csv](tables/family_pair_deltas.csv)
- [family_effects.csv](tables/family_effects.csv)
- [rubric_embeddings.csv](tables/rubric_embeddings.csv)
- [rubric_stage_embeddings.csv](tables/rubric_stage_embeddings.csv)
- [rubric_criterion_embeddings.csv](tables/rubric_criterion_embeddings.csv)
- [rubric_experiment_similarity.csv](tables/rubric_experiment_similarity.csv)
- [rubric_experiment_clusters.csv](tables/rubric_experiment_clusters.csv)
- [rubric_focus_similarity.csv](tables/rubric_focus_similarity.csv)
- [rubric_focus_clusters.csv](tables/rubric_focus_clusters.csv)
- [rubric_contrast_similarity.csv](tables/rubric_contrast_similarity.csv)
- [rubric_stage_contrast_similarity.csv](tables/rubric_stage_contrast_similarity.csv)
- [scale_matching_validation.csv](tables/scale_matching_validation.csv)
- [scale_certainty_effects.csv](tables/scale_certainty_effects.csv)
- [scale_certainty_regression.csv](tables/scale_certainty_regression.csv)
- [sample_instability.csv](tables/sample_instability.csv)
- [experiment_distances.csv](tables/experiment_distances.csv)
- [bundle_verdict_profiles.csv](tables/bundle_verdict_profiles.csv)
- [bundle_belief_tbm.csv](tables/bundle_belief_tbm.csv)
- [bundle_belief_closed_world.csv](tables/bundle_belief_closed_world.csv)
- [candidate_findings.csv](tables/candidate_findings.csv)
- [mine_v3_ranked_findings.csv](tables/mine_v3_ranked_findings.csv)
- [mine_v3_summary.md](tables/mine_v3_summary.md)
- [aggregation_sensitivity_sample_methods.csv](tables/aggregation_sensitivity_sample_methods.csv)
- [aggregation_sensitivity_method_summary.csv](tables/aggregation_sensitivity_method_summary.csv)
- [aggregation_sensitivity_method_alignment.csv](tables/aggregation_sensitivity_method_alignment.csv)
- [aggregation_sensitivity_contrast_sensitivity.csv](tables/aggregation_sensitivity_contrast_sensitivity.csv)
- [aggregation_sensitivity_report_panel.csv](tables/aggregation_sensitivity_report_panel.csv)

## Figures

- [family_effect_heatmap.png](figures/family_effect_heatmap.png)
- [experiment_adjudicative_heatmap.png](figures/experiment_adjudicative_heatmap.png)
- [family_effect_abstain_rate.png](figures/family_effect_abstain_rate.png)
- [family_effect_mean_subset_size.png](figures/family_effect_mean_subset_size.png)
- [curated/hero_contrast_heatmap.png](figures/curated/hero_contrast_heatmap.png)
- [curated/hero_scale_probe_profile.png](figures/curated/hero_scale_probe_profile.png)
- [curated/hero_bundle_strategy_heatmap.png](figures/curated/hero_bundle_strategy_heatmap.png)
- [rubric_similarity_heatmap.png](figures/rubric_similarity_heatmap.png)
- [rubric_similarity_dendrogram.png](figures/rubric_similarity_dendrogram.png)
- [rubric_focus_heatmap.png](figures/rubric_focus_heatmap.png)
- [rubric_focus_dendrogram.png](figures/rubric_focus_dendrogram.png)
- [rubric_stage_similarity_heatmap.png](figures/rubric_stage_similarity_heatmap.png)
- [sample_instability.png](figures/sample_instability.png)
- [sample_expected_stage_heatmap.png](figures/sample_expected_stage_heatmap.png)
- [sample_abstain_heatmap.png](figures/sample_abstain_heatmap.png)
- [scale_certainty_effects.png](figures/scale_certainty_effects.png)
- [family_verdict_heatmaps/](figures/family_verdict_heatmaps)
- [family_belief_heatmaps/](figures/family_belief_heatmaps)

## Caveats

- Matching is validated only through exported sample/bundle/window signatures in this pass; it is not yet guaranteed that every family corresponds to identical internal sampling objects.
- The invalid original `a6/a7` bundle families are excluded from interpretation; the corrected V3.1 bundle families are now part of the matched statistical pass.
- Belief/conflict metrics are included as diagnostics, not headline endpoints.
"""


def _top_effects_markdown(family_effects: pd.DataFrame) -> str:
    if family_effects.empty:
        return "- No family effects available yet."
    primary = family_effects[
        family_effects["endpoint"].isin(["abstain_rate", "singleton_rate", "mean_subset_size", "mean_expected_stage"])
    ].copy()
    primary["abs_mean_delta"] = primary["mean_delta"].abs()
    top = primary.sort_values("abs_mean_delta", ascending=False).head(6)
    lines = []
    for row in top.itertuples():
        lines.append(
            f"- `{row.contrast_id}` on `{row.endpoint}`: mean delta `{row.mean_delta:.3f}` "
            f"(95% bootstrap CI `{row.ci_low:.3f}` to `{row.ci_high:.3f}`, `n={row.n_samples}`)"
        )
    return "\n".join(lines)


def _headline_findings_markdown(
    *,
    experiment_metrics: pd.DataFrame,
    matching_validation: pd.DataFrame,
    family_effects: pd.DataFrame,
) -> str:
    lines: list[str] = []

    def effect_line(contrast_contains: str, endpoint: str, text: str) -> None:
        if family_effects.empty:
            return
        subset = family_effects[
            family_effects["contrast_id"].str.contains(contrast_contains, regex=False)
            & (family_effects["endpoint"] == endpoint)
        ]
        if subset.empty:
            return
        row = subset.sort_values("mean_delta", key=lambda s: s.abs(), ascending=False).iloc[0]
        lines.append(
            text.format(
                contrast_id=row["contrast_id"],
                mean_delta=row["mean_delta"],
                ci_low=row["ci_low"],
                ci_high=row["ci_high"],
            )
        )

    effect_line(
        "a1_abstain_toggle",
        "abstain_rate",
        "- Abstention is a real behavioral lever, not a cosmetic flag: `{contrast_id}` shifts abstain rate by `{mean_delta:.3f}` (95% CI `{ci_low:.3f}` to `{ci_high:.3f}`).",
    )
    effect_line(
        "a4_model_swap",
        "abstain_rate",
        "- In `a4`, swapping rubric/scoring model roles moves abstention more than stage severity: `{contrast_id}` changes abstain rate by `{mean_delta:.3f}` (95% CI `{ci_low:.3f}` to `{ci_high:.3f}`).",
    )
    effect_line(
        "a5_concept_swap",
        "mean_subset_size",
        "- `a5` is one of the strongest semantic interventions: `{contrast_id}` changes mean subset size by `{mean_delta:.3f}` (95% CI `{ci_low:.3f}` to `{ci_high:.3f}`).",
    )
    effect_line(
        "c1_bundle_strategy",
        "tbm_conflict",
        "- In the corrected bundle follow-up, grouping policy itself is a real lever: `{contrast_id}` changes TBM conflict by `{mean_delta:.3f}` (95% CI `{ci_low:.3f}` to `{ci_high:.3f}`).",
    )
    effect_line(
        "c6_scale_probe",
        "mean_subset_size",
        "- In the clustered high-scale probe, `{contrast_id}` changes mean subset size by `{mean_delta:.3f}` (95% CI `{ci_low:.3f}` to `{ci_high:.3f}`).",
    )

    unmatched = matching_validation[~matching_validation["fully_matched"]] if not matching_validation.empty else pd.DataFrame()
    if not unmatched.empty:
        contrast_ids = ", ".join(f"`{value}`" for value in unmatched["contrast_id"].tolist())
        lines.append(
            f"- Some contrasts still remain descriptive only: {contrast_ids} include unmatched samples or unresolved signature differences."
        )

    if not experiment_metrics.empty:
        for experiment_tag in ["v3_d1_control_gpt_4_1", "v3_d1_control_gpt_5_2"]:
            subset = experiment_metrics[experiment_metrics["experiment_tag"] == experiment_tag]
            if subset.empty:
                continue
            row = subset.iloc[0]
            lines.append(
                f"- `{experiment_tag}` is an interpretability anchor rather than a normal comparator: abstain rate is `{row['abstain_rate']:.3f}`, singleton rate is `{row['singleton_rate']:.3f}`, and closed-world conflict is `{row['mean_closed_world_conflict']:.3f}`."
            )
    return "\n".join(lines) if lines else "- No headline findings available yet."


def _candidate_findings_markdown(candidate_findings: pd.DataFrame) -> str:
    if candidate_findings.empty:
        return "- No candidate findings available yet."
    top = candidate_findings.head(8)
    return "\n".join(
        f"- `{row.finding_kind}`: {row.summary}"
        for row in top.itertuples()
    )


def _instability_markdown(sample_instability: pd.DataFrame) -> str:
    if sample_instability.empty:
        return "- No sample instability table available yet."
    top = sample_instability.head(5)
    lines = []
    for row in top.itertuples():
        lines.append(
            f"- `S{row.sample_ordinal:02d}` instability `{row.instability_score:.3f}` "
            f"(abstain std `{row.abstain_rate_std:.3f}`, subset std `{row.mean_subset_size_std:.3f}`, expected-stage std `{row.mean_expected_stage_std:.3f}`)"
        )
    return "\n".join(lines)


def _distance_markdown(experiment_distances: pd.DataFrame) -> str:
    if experiment_distances.empty:
        return "- No experiment distance table available yet."
    top = experiment_distances.head(5)
    return "\n".join(
        f"- `{row.experiment_a}` vs `{row.experiment_b}` distance `{row.distance:.3f}`"
        for row in top.itertuples()
    )


def _geometry_markdown(experiment_geometry: pd.DataFrame) -> str:
    if experiment_geometry.empty:
        return "- No adjudicative geometry table available yet."
    rows = []
    low_mid = experiment_geometry.nsmallest(3, "mid_scale_mass")
    low_entropy = experiment_geometry.nsmallest(3, "stage_entropy")
    for row in low_mid.itertuples():
        rows.append(
            f"- Low mid-scale occupancy: `{row.experiment_tag}` mid-scale mass `{row.mid_scale_mass:.3f}`, stage entropy `{row.stage_entropy:.3f}`."
        )
    for row in low_entropy.itertuples():
        if any(f"`{row.experiment_tag}`" in line for line in rows):
            continue
        rows.append(
            f"- Low stage entropy: `{row.experiment_tag}` stage entropy `{row.stage_entropy:.3f}`, abstain mass `{row.abstain_mass:.3f}`."
        )
    return "\n".join(rows)


def _rubric_similarity_markdown(
    rubric_contrast_similarity: pd.DataFrame,
    rubric_focus_similarity: pd.DataFrame,
    rubric_stage_contrast_similarity: pd.DataFrame,
) -> str:
    if rubric_contrast_similarity.empty and rubric_focus_similarity.empty and rubric_stage_contrast_similarity.empty:
        return "- No rubric similarity table available yet."
    lines: list[str] = []
    if not rubric_focus_similarity.empty:
        summary = rubric_focus_similarity[
            rubric_focus_similarity["experiment_a"] != rubric_focus_similarity["experiment_b"]
        ].copy()
        if not summary.empty:
            highest = summary.sort_values("cosine_similarity", ascending=False).head(3)
            lowest = summary.sort_values("cosine_similarity").head(3)
            lines.append("- Focused model-family rubric clustering:")
            lines.extend(
                f"  - highest cosine `{row.experiment_a}` vs `{row.experiment_b}` = `{row.cosine_similarity:.3f}`."
                for row in highest.itertuples()
            )
            lines.extend(
                f"  - lowest cosine `{row.experiment_a}` vs `{row.experiment_b}` = `{row.cosine_similarity:.3f}`."
                for row in lowest.itertuples()
            )
    if not rubric_contrast_similarity.empty:
        summary = rubric_contrast_similarity[rubric_contrast_similarity["sample_ordinal"] == -1].copy()
        if not summary.empty:
            rows = summary.sort_values("cosine_similarity").head(5)
            lines.extend(
                f"- Full-rubric similarity: `{row.contrast_id}` mean cosine `{row.cosine_similarity:.3f}`."
                for row in rows.itertuples()
            )
    if not rubric_stage_contrast_similarity.empty:
        stage_summary = rubric_stage_contrast_similarity[
            rubric_stage_contrast_similarity["sample_ordinal"] == -1
        ].copy()
        if not stage_summary.empty:
            lowest = stage_summary.sort_values("cosine_similarity").head(5)
            lines.extend(
                f"- Stage-level similarity: `{row.contrast_id}` stage `{int(row.stage_number)}` mean cosine `{row.cosine_similarity:.3f}`."
                for row in lowest.itertuples()
            )
    return "\n".join(lines) if lines else "- No contrast-level rubric similarity summary available yet."


def _scale_certainty_markdown(
    *,
    scale_matching_validation: pd.DataFrame,
    scale_certainty_effects: pd.DataFrame,
    scale_certainty_regression: pd.DataFrame,
) -> str:
    if scale_matching_validation.empty and scale_certainty_effects.empty and scale_certainty_regression.empty:
        return "- No scale-size contrasts were available for this pass."
    lines: list[str] = []
    if not scale_matching_validation.empty:
        matched = scale_matching_validation[scale_matching_validation["fully_matched"]]
        if not matched.empty:
            lines.append(
                f"- Fully matched scale-size contrasts: {', '.join(f'`{value}`' for value in matched['contrast_id'].tolist())}."
            )
    if not scale_certainty_effects.empty:
        certainty = scale_certainty_effects[
            scale_certainty_effects["endpoint"] == "mean_score_expert_agreement_prob"
        ].copy()
        if not certainty.empty:
            for row in certainty.sort_values("mean_delta", key=lambda s: s.abs(), ascending=False).head(4).itertuples():
                lines.append(
                    f"- `{row.contrast_id}` changes expert-agreement certainty by `{row.mean_delta:.3f}` "
                    f"(95% CI `{row.ci_low:.3f}` to `{row.ci_high:.3f}`, `n={row.n_samples}`)."
                )
    if not scale_certainty_regression.empty:
        subset = scale_certainty_regression[scale_certainty_regression["term"] == "scale_size"]
        if not subset.empty:
            row = subset.iloc[0]
            lines.append(
                f"- Response-level OLS on matched scale-size experiments estimates a `scale_size` coefficient of "
                f"`{row['coef']:.3f}` on expert-agreement certainty (95% CI `{row['conf_low']:.3f}` to `{row['conf_high']:.3f}`, `p={row['pvalue']:.3g}`, `R^2={row['r_squared']:.3f}`)."
            )
    return "\n".join(lines) if lines else "- No scale-size certainty summary available yet."


def _expected_stage(decoded_scores: list[int]) -> float:
    if not decoded_scores:
        return float("nan")
    return float(np.mean(decoded_scores))


def _mean_stage_distribution(verdicts: Iterable[list[int]], scale_size: int) -> np.ndarray:
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


def _belief_expected_stage(row: pd.Series) -> float:
    weights = []
    for column in row.index:
        if column.startswith("betP_"):
            stage = int(column.removeprefix("betP_"))
            weights.append(stage * float(row[column]))
    return float(sum(weights))


def _bootstrap_ci(values: np.ndarray, rng: np.random.Generator, *, iters: int = 2000) -> tuple[float, float]:
    if len(values) == 1:
        return float(values[0]), float(values[0])
    draws = rng.choice(values, size=(iters, len(values)), replace=True)
    means = draws.mean(axis=1)
    return float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975))


def _sign_flip_pvalue(values: np.ndarray, rng: np.random.Generator, *, iters: int = 5000) -> float:
    if len(values) == 0:
        return float("nan")
    observed = abs(float(values.mean()))
    if observed == 0:
        return 1.0
    signs = rng.choice([-1.0, 1.0], size=(iters, len(values)))
    permuted = np.abs((signs * values).mean(axis=1))
    return float((np.count_nonzero(permuted >= observed) + 1) / (iters + 1))


def _effect_size(values: np.ndarray) -> float:
    if len(values) < 2:
        return float("nan")
    std = float(values.std(ddof=1))
    if std == 0:
        return float("nan")
    return float(values.mean() / std)


def _benjamini_hochberg(pvalues: np.ndarray) -> np.ndarray:
    if len(pvalues) == 0:
        return np.array([], dtype=float)
    order = np.argsort(pvalues)
    ranked = pvalues[order]
    n = len(ranked)
    adjusted = np.empty(n, dtype=float)
    running = 1.0
    for index in range(n - 1, -1, -1):
        rank = index + 1
        value = min(running, ranked[index] * n / rank)
        adjusted[index] = value
        running = value
    result = np.empty(n, dtype=float)
    result[order] = np.clip(adjusted, 0.0, 1.0)
    return result


def _delta(left: float | int | None, right: float | int | None) -> float:
    if left is None or right is None:
        return float("nan")
    if pd.isna(left) or pd.isna(right):
        return float("nan")
    return float(right) - float(left)


def _safe_mean(series: pd.Series) -> float:
    if len(series) == 0:
        return float("nan")
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return float("nan")
    return float(clean.mean())


def _safe_std(series: pd.Series) -> float:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if len(clean) < 2:
        return 0.0
    return float(clean.std(ddof=1))


def _safe_quantile(series: pd.Series, quantile: float) -> float:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return float("nan")
    return float(clean.quantile(quantile))


def _safe_iqr(series: pd.Series) -> float:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return float("nan")
    return float(clean.quantile(0.75) - clean.quantile(0.25))


def _trimmed_mean(series: pd.Series, proportion: float = 0.1) -> float:
    clean = pd.to_numeric(series, errors="coerce").dropna().sort_values()
    if clean.empty:
        return float("nan")
    trim = int(len(clean) * proportion)
    if trim * 2 >= len(clean):
        return float(clean.mean())
    return float(clean.iloc[trim : len(clean) - trim].mean())


def _signature(values: Iterable[str]) -> str:
    return " | ".join(sorted(set(str(value) for value in values if value not in (None, ""))))


def _flatten(values: Iterable[Iterable[str]]) -> list[str]:
    flattened: list[str] = []
    for row in values:
        flattened.extend(str(item) for item in row)
    return flattened


def _matching_note(
    checks: list[bool],
    baseline_count: int,
    variant_count: int,
    matched_rows: int,
    match_mode: str = "strict",
) -> str:
    if not checks:
        return "No overlapping samples."
    if all(checks) and baseline_count == variant_count == matched_rows:
        if match_mode == "window_only":
            return "All samples matched on window/bundle-size signatures; bundle memberships intentionally differ."
        return "All samples matched on bundle/window signatures."
    if match_mode == "window_only":
        return "Some samples mismatch on window/bundle-size signatures or are missing in one condition."
    return "Some samples mismatch on bundle/window signatures or are missing in one condition."


def _record_for_all(
    connection,
    snapshot_ids: Iterable[str],
    artifact_kind: str,
    path: Path,
    *,
    report_name: str,
    metadata: dict[str, object] | None = None,
) -> None:
    payload = metadata or {}
    for snapshot_id in snapshot_ids:
        record_artifact(
            connection,
            snapshot_id=snapshot_id,
            report_name=report_name,
            artifact_kind=artifact_kind,
            path=str(path),
            metadata=payload,
        )
