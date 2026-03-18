from __future__ import annotations

import json
import math
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
from .datasets import SnapshotBundle, load_snapshot_bundle
from .report_pilot import (
    _build_belief_frame,
    _build_experiment_metrics,
    family_groups_for_tags,
    family_slug_from_tag,
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
    "mean_score_expert_agreement_prob",
    "tbm_conflict",
    "closed_world_conflict",
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


def default_investigation_root() -> Path:
    return Path(__file__).resolve().parents[2] / "_outputs" / "v3" / "investigation"


def generate_v3_investigation(
    *,
    snapshot_ids: list[str] | None = None,
    experiment_tags: list[str] | None = None,
    cache_db_path: str | None = None,
    output_dir: str | Path | None = None,
    rubric_embedding_model: str = DEFAULT_RUBRIC_EMBEDDING_MODEL,
    rubric_embedding_encoder=None,
) -> Path:
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
        contrasts = _build_family_contrasts(bundle)
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
        scale_contrasts = _build_scale_size_contrasts(bundle)
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
        sample_instability = _build_sample_instability(sample_metrics)
        experiment_distances = _build_experiment_distances(experiment_metrics)
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
            tables_dir / "family_pair_deltas.csv": family_pair_deltas,
            tables_dir / "family_effects.csv": family_effects,
            tables_dir / "sample_instability.csv": sample_instability,
            tables_dir / "experiment_distances.csv": experiment_distances,
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

        figure_paths = _write_figures(
            experiment_geometry=experiment_geometry,
            family_effects=family_effects,
            rubric_experiment_similarity=rubric_experiment_similarity,
            rubric_stage_contrast_similarity=rubric_stage_contrast_similarity,
            sample_instability=sample_instability,
            sample_metrics=sample_metrics,
            scale_certainty_effects=scale_certainty_effects,
            figures_dir=figures_dir,
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
    for family_slug, tags in family_groups_for_tags(bundle.experiment_tags).items():
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

    return contrasts


def _build_scale_size_contrasts(bundle: SnapshotBundle) -> list[FamilyContrast]:
    contrasts: list[FamilyContrast] = []
    a1_true: dict[str, str] = {}
    a3_scale: dict[str, str] = {}
    for tag, experiment in bundle.experiments.items():
        family = family_slug_from_tag(tag)
        model_id = str(experiment.get("model_id"))
        if family == "a1_abstain_toggle" and bool(experiment.get("abstain_enabled")):
            a1_true[model_id] = tag
        if family == "a3_scale_size":
            a3_scale[model_id] = tag

    for model_id in sorted(set(a1_true) & set(a3_scale)):
        baseline_tag = a1_true[model_id]
        variant_tag = a3_scale[model_id]
        baseline_scale = int(bundle.experiments[baseline_tag]["scale_size"])
        variant_scale = int(bundle.experiments[variant_tag]["scale_size"])
        if baseline_scale == variant_scale:
            continue
        if baseline_scale > variant_scale:
            baseline_tag, variant_tag = variant_tag, baseline_tag
            baseline_scale, variant_scale = variant_scale, baseline_scale
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
    return contrasts


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
        bundle_signature = _signature(group["bundle_label"].tolist())
        window_signature = _signature(_flatten(group["window_ids"]))
        sample_rows.append(
            {
                "experiment_tag": tag,
                "family_slug": family_slug_from_tag(tag),
                "model_id": experiment["model_id"],
                "sample_ordinal": int(sample_ordinal),
                "sample_id": sample_id,
                "response_rows": int(len(group)),
                "unique_bundle_count": int(group["bundle_label"].nunique()),
                "bundle_signature": bundle_signature,
                "window_signature": window_signature,
                "bundle_size_signature": _signature(group["bundle_size"].astype(str).tolist()),
                "abstain_rate": float(group["abstained"].mean()),
                "abstain_count": int(group["abstained"].sum()),
                "singleton_rate": _safe_mean(non_abstain["is_singleton"]),
                "mean_subset_size": _safe_mean(non_abstain["subset_size"]),
                "mean_expected_stage": _safe_mean(non_abstain["expected_stage"]),
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
    for (tag, sample_ordinal, bundle_label), group in responses.groupby(
        ["experiment_tag", "sample_ordinal", "bundle_label"],
        dropna=False,
    ):
        non_abstain = group[~group["abstained"]]
        rows.append(
            {
                "experiment_tag": tag,
                "family_slug": family_slug_from_tag(tag),
                "sample_ordinal": int(sample_ordinal),
                "bundle_label": bundle_label,
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
        ["family_slug", "experiment_tag", "sample_ordinal", "bundle_label"],
    ).reset_index(drop=True)


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
    rows: list[dict[str, object]] = []
    for idx, experiment_tag in enumerate(similarity.index):
        rows.append(
            {
                "experiment_tag": experiment_tag,
                "cluster_id": int(cluster_ids[idx]),
                "cluster_order": int(order.index(idx)),
            }
        )
    return pd.DataFrame(rows).sort_values(["cluster_id", "cluster_order"]).reset_index(drop=True)


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
                "notes": _matching_note(all_checks, len(baseline), len(variant), matched_rows),
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
    endpoints = PRIMARY_ENDPOINTS + [
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


def _write_figures(
    *,
    experiment_geometry: pd.DataFrame,
    family_effects: pd.DataFrame,
    rubric_experiment_similarity: pd.DataFrame,
    rubric_stage_contrast_similarity: pd.DataFrame,
    sample_instability: pd.DataFrame,
    sample_metrics: pd.DataFrame,
    scale_certainty_effects: pd.DataFrame,
    figures_dir: Path,
) -> list[Path]:
    paths: list[Path] = []
    if not experiment_geometry.empty:
        geometry_columns = [
            column
            for column in experiment_geometry.columns
            if column.startswith("mass_stage_")
        ]
        geometry_columns = ["abstain_mass", *sorted(geometry_columns, key=lambda value: int(value.rsplit("_", 1)[-1]))]
        heatmap = experiment_geometry.set_index("experiment_tag")[geometry_columns].astype(float)
        fig, ax = plt.subplots(figsize=(10, max(5, 0.45 * len(heatmap.index))))
        sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="rocket_r", ax=ax, vmin=0, vmax=1)
        ax.set_title("Adjudicative geometry by experiment")
        ax.set_xlabel("Fractional stage occupancy")
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
            fig, ax = plt.subplots(figsize=(10, max(4, 0.5 * len(heatmap.index))))
            sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="coolwarm", center=0, ax=ax)
            ax.set_title("Family effect deltas (matched samples)")
            fig.tight_layout()
            path = figures_dir / "family_effect_heatmap.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

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

    if not sample_metrics.empty:
        expected_stage = sample_metrics.pivot(
            index="sample_ordinal",
            columns="experiment_tag",
            values="mean_expected_stage",
        ).sort_index()
        if not expected_stage.empty:
            fig, ax = plt.subplots(figsize=(12, max(6, 0.3 * len(expected_stage.index))))
            sns.heatmap(expected_stage, cmap="YlOrRd", ax=ax, vmin=1, vmax=max(1, np.nanmax(expected_stage.to_numpy())))
            ax.set_title("Sample-by-experiment expected stage")
            ax.set_xlabel("Experiment")
            ax.set_ylabel("Sample ordinal")
            fig.tight_layout()
            path = figures_dir / "sample_expected_stage_heatmap.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

        abstain = sample_metrics.pivot(
            index="sample_ordinal",
            columns="experiment_tag",
            values="abstain_rate",
        ).sort_index()
        if not abstain.empty:
            fig, ax = plt.subplots(figsize=(12, max(6, 0.3 * len(abstain.index))))
            sns.heatmap(abstain, cmap="Greys", ax=ax, vmin=0, vmax=1)
            ax.set_title("Sample-by-experiment abstain rate")
            ax.set_xlabel("Experiment")
            ax.set_ylabel("Sample ordinal")
            fig.tight_layout()
            path = figures_dir / "sample_abstain_heatmap.png"
            fig.savefig(path, dpi=200, bbox_inches="tight")
            plt.close(fig)
            paths.append(path)

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

    return paths


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
- [rubric_contrast_similarity.csv](tables/rubric_contrast_similarity.csv)
- [rubric_stage_contrast_similarity.csv](tables/rubric_stage_contrast_similarity.csv)
- [scale_matching_validation.csv](tables/scale_matching_validation.csv)
- [scale_certainty_effects.csv](tables/scale_certainty_effects.csv)
- [scale_certainty_regression.csv](tables/scale_certainty_regression.csv)
- [sample_instability.csv](tables/sample_instability.csv)
- [experiment_distances.csv](tables/experiment_distances.csv)
- [candidate_findings.csv](tables/candidate_findings.csv)

## Figures

- [family_effect_heatmap.png](figures/family_effect_heatmap.png)
- [experiment_adjudicative_heatmap.png](figures/experiment_adjudicative_heatmap.png)
- [family_effect_abstain_rate.png](figures/family_effect_abstain_rate.png)
- [family_effect_mean_subset_size.png](figures/family_effect_mean_subset_size.png)
- [rubric_similarity_heatmap.png](figures/rubric_similarity_heatmap.png)
- [rubric_similarity_dendrogram.png](figures/rubric_similarity_dendrogram.png)
- [rubric_stage_similarity_heatmap.png](figures/rubric_stage_similarity_heatmap.png)
- [sample_instability.png](figures/sample_instability.png)
- [sample_expected_stage_heatmap.png](figures/sample_expected_stage_heatmap.png)
- [sample_abstain_heatmap.png](figures/sample_abstain_heatmap.png)
- [scale_certainty_effects.png](figures/scale_certainty_effects.png)

## Caveats

- Matching is validated only through exported sample/bundle/window signatures in this pass; it is not yet guaranteed that every family corresponds to identical internal sampling objects.
- `a6/a7` and `d1` operate on different response densities, so conflict metrics remain vulnerable to denominator effects.
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

    unmatched = matching_validation[~matching_validation["fully_matched"]] if not matching_validation.empty else pd.DataFrame()
    if not unmatched.empty:
        contrast_ids = ", ".join(f"`{value}`" for value in unmatched["contrast_id"].tolist())
        lines.append(
            f"- `a6/a7` should currently be treated as descriptive only: {contrast_ids} share window signatures but not bundle signatures, so the per-sample bundles are regrouped across models."
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
    rubric_stage_contrast_similarity: pd.DataFrame,
) -> str:
    if rubric_contrast_similarity.empty and rubric_stage_contrast_similarity.empty:
        return "- No rubric similarity table available yet."
    lines: list[str] = []
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


def _signature(values: Iterable[str]) -> str:
    return " | ".join(sorted(set(str(value) for value in values if value not in (None, ""))))


def _flatten(values: Iterable[Iterable[str]]) -> list[str]:
    flattened: list[str] = []
    for row in values:
        flattened.extend(str(item) for item in row)
    return flattened


def _matching_note(checks: list[bool], baseline_count: int, variant_count: int, matched_rows: int) -> str:
    if not checks:
        return "No overlapping samples."
    if all(checks) and baseline_count == variant_count == matched_rows:
        return "All samples matched on bundle/window signatures."
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
