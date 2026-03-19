from __future__ import annotations

import hashlib
import json
import math
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
from typing import Iterable

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import statsmodels.formula.api as smf
from pyds import MassFunction

from .cache import connect_cache, record_artifact
from .datasets import SnapshotBundle, load_snapshot_bundle

FAMILY_LABELS = {
    "a1": "abstain_toggle",
    "a2": "evidence_level_l3",
    "a3": "scale_size",
    "a4": "model_swap",
    "a5": "concept_swap",
    "a6": "bundle_5_l2",
    "a7": "bundle_5_l3",
    "b1": "small_model_family",
    "d1": "control",
}

OVERVIEW_METRICS = [
    "abstain_rate",
    "singleton_rate",
    "mean_subset_size",
    "mean_score_expert_agreement_prob",
    "mean_rubric_observability_score",
    "mean_rubric_discriminability_score",
    "mean_tbm_conflict",
    "mean_closed_world_conflict",
]


def default_output_root() -> Path:
    return Path(__file__).resolve().parents[2] / "_outputs" / "v3"


def generate_pilot_report(
    *,
    snapshot_ids: list[str] | None = None,
    experiment_tags: list[str] | None = None,
    cache_db_path: str | None = None,
    output_dir: str | Path | None = None,
    report_name: str = "pilot_v3",
) -> Path:
    bundle = load_snapshot_bundle(
        snapshot_ids=snapshot_ids,
        experiment_tags=experiment_tags,
        cache_db_path=cache_db_path,
    )
    root = Path(output_dir) if output_dir is not None else (
        default_output_root() / _report_slug(bundle)
    )
    return _generate_bundle_report(
        bundle,
        cache_db_path=cache_db_path,
        output_dir=root,
        report_name=report_name,
    )


def generate_v3_report_suite(
    *,
    snapshot_ids: list[str] | None = None,
    experiment_tags: list[str] | None = None,
    cache_db_path: str | None = None,
    output_dir: str | Path | None = None,
) -> Path:
    bundle = load_snapshot_bundle(
        snapshot_ids=snapshot_ids,
        experiment_tags=experiment_tags,
        cache_db_path=cache_db_path,
    )
    root = Path(output_dir) if output_dir is not None else default_output_root()
    root.mkdir(parents=True, exist_ok=True)

    connection = connect_cache(cache_db_path)
    try:
        _write_suite_manifest(bundle, root)
        _write_overview_report(bundle, root / "overview", connection)

        experiments_dir = root / "experiments"
        for tag in bundle.experiment_tags:
            report_dir = experiments_dir / tag
            _generate_bundle_report(
                subset_bundle(bundle, [tag]),
                cache_db_path=cache_db_path,
                output_dir=report_dir,
                report_name=f"pilot_v3_experiment:{tag}",
            )

        families_dir = root / "families"
        for family_slug, tags in family_groups_for_tags(bundle.experiment_tags).items():
            _generate_bundle_report(
                subset_bundle(bundle, tags),
                cache_db_path=cache_db_path,
                output_dir=families_dir / family_slug,
                report_name=f"pilot_v3_family:{family_slug}",
            )

        summary = {
            "snapshot_ids": bundle.snapshot_ids,
            "experiment_tags": bundle.experiment_tags,
            "family_groups": family_groups_for_tags(bundle.experiment_tags),
            "experiment_count": len(bundle.experiment_tags),
            "family_count": len(family_groups_for_tags(bundle.experiment_tags)),
            "overview_dir": str((root / "overview").resolve()),
            "experiments_dir": str((root / "experiments").resolve()),
            "families_dir": str((root / "families").resolve()),
        }
        summary_path = root / "summary.json"
        summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True))
        _record_for_all(
            connection,
            bundle.snapshot_ids,
            "summary",
            summary_path,
            report_name="pilot_v3_suite",
            metadata=summary,
        )
    finally:
        connection.close()

    return root


def subset_bundle(bundle: SnapshotBundle, experiment_tags: list[str]) -> SnapshotBundle:
    wanted = set(experiment_tags)
    snapshot_ids = [
        snapshot_id
        for snapshot_id in bundle.snapshot_ids
        if bundle.manifests[snapshot_id]["experiment"]["experiment_tag"] in wanted
    ]
    manifests = {
        snapshot_id: bundle.manifests[snapshot_id]
        for snapshot_id in snapshot_ids
    }

    def filter_frame(frame: pd.DataFrame) -> pd.DataFrame:
        if frame.empty:
            return frame.copy()
        return frame[frame["experiment_tag"].isin(wanted)].copy()

    return SnapshotBundle(
        snapshot_ids=snapshot_ids,
        manifests=manifests,
        responses=filter_frame(bundle.responses),
        rubrics=filter_frame(bundle.rubrics),
        evidence=filter_frame(bundle.evidence),
        samples=filter_frame(bundle.samples),
        response_items=filter_frame(bundle.response_items),
    )


def _generate_bundle_report(
    bundle: SnapshotBundle,
    *,
    cache_db_path: str | None,
    output_dir: Path,
    report_name: str,
) -> Path:
    figures_dir = output_dir / "figures"
    tables_dir = output_dir / "tables"
    figures_dir.mkdir(parents=True, exist_ok=True)
    tables_dir.mkdir(parents=True, exist_ok=True)

    connection = connect_cache(cache_db_path)
    try:
        _write_manifest(bundle, output_dir)
        _write_evidence_table(bundle, tables_dir, connection, report_name)
        _plot_stage_counts(bundle, figures_dir, connection, report_name)
        _run_length_bias(bundle, tables_dir, figures_dir, connection, report_name)
        _write_rates(bundle, tables_dir, figures_dir, connection, report_name)
        tbm_df = _write_belief_reports(bundle, tables_dir, figures_dir, connection, report_name)
        closed_df = _write_closed_world_reports(bundle, tables_dir, figures_dir, connection, report_name)
        _write_divergence(
            bundle,
            tbm_df,
            closed_df,
            tables_dir,
            figures_dir,
            connection,
            report_name,
        )
        summary = {
            "snapshot_ids": bundle.snapshot_ids,
            "experiment_tags": bundle.experiment_tags,
            "response_rows": int(len(bundle.responses)),
            "rubric_rows": int(len(bundle.rubrics)),
            "evidence_rows": int(len(bundle.evidence)),
            "sample_rows": int(len(bundle.samples)),
            "response_item_rows": int(len(bundle.response_items)),
        }
        summary_path = output_dir / "summary.json"
        summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True))
        _record_for_all(
            connection,
            bundle.snapshot_ids,
            "summary",
            summary_path,
            report_name=report_name,
            metadata=summary,
        )
    finally:
        connection.close()

    return output_dir


def _report_slug(bundle: SnapshotBundle) -> str:
    joined = "__".join(bundle.experiment_tags)
    if len(joined) <= 120:
        return joined
    digest = hashlib.sha1(joined.encode("utf-8")).hexdigest()[:12]
    return f"{len(bundle.experiment_tags)}_experiments_{digest}"


def family_code_from_tag(tag: str) -> str:
    parts = tag.split("_")
    return parts[1] if len(parts) > 1 else "misc"


def family_slug_from_tag(tag: str) -> str:
    code = family_code_from_tag(tag)
    label = FAMILY_LABELS.get(code, code)
    return f"{code}_{label}"


def variant_slug_from_tag(tag: str) -> str:
    parts = tag.split("_", 2)
    return parts[2] if len(parts) > 2 else tag


def family_groups_for_tags(tags: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for tag in sorted(tags):
        groups[family_slug_from_tag(tag)].append(tag)
    return dict(sorted(groups.items()))


def display_label_for_tag(bundle: SnapshotBundle, tag: str) -> str:
    if len(bundle.experiment_tags) == 1:
        return bundle.experiments[tag]["model_id"]
    model_counts = Counter(
        bundle.experiments[current_tag]["model_id"]
        for current_tag in bundle.experiment_tags
    )
    model_id = bundle.experiments[tag]["model_id"]
    if model_counts[model_id] == 1:
        return model_id
    return tag


def _write_suite_manifest(bundle: SnapshotBundle, root: Path) -> None:
    manifest = {
        "snapshot_ids": bundle.snapshot_ids,
        "experiments": bundle.experiments,
        "family_groups": family_groups_for_tags(bundle.experiment_tags),
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))


def _write_manifest(bundle: SnapshotBundle, root: Path) -> None:
    manifest = {
        "snapshot_ids": bundle.snapshot_ids,
        "experiments": bundle.experiments,
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))


def _write_overview_report(bundle: SnapshotBundle, root: Path, connection) -> None:
    figures_dir = root / "figures"
    tables_dir = root / "tables"
    figures_dir.mkdir(parents=True, exist_ok=True)
    tables_dir.mkdir(parents=True, exist_ok=True)

    _write_manifest(bundle, root)
    metrics_df = _build_experiment_metrics(bundle)
    metrics_path = tables_dir / "experiment_metrics.csv"
    metrics_df.to_csv(metrics_path, index=False)
    _record_for_all(
        connection,
        bundle.snapshot_ids,
        "table",
        metrics_path,
        report_name="pilot_v3_overview",
    )

    family_membership = metrics_df[
        [
            "experiment_tag",
            "family_code",
            "family_slug",
            "variant_slug",
            "model_id",
            "rubric_model",
            "scoring_model",
            "concept",
            "evidence_view",
            "evidence_bundle_size",
            "abstain_enabled",
        ]
    ]
    membership_path = tables_dir / "family_membership.csv"
    family_membership.to_csv(membership_path, index=False)
    _record_for_all(
        connection,
        bundle.snapshot_ids,
        "table",
        membership_path,
        report_name="pilot_v3_overview",
    )

    family_summary = metrics_df.groupby(
        ["family_code", "family_slug"],
        as_index=False,
    ).agg(
        experiment_count=("experiment_tag", "count"),
        mean_abstain_rate=("abstain_rate", "mean"),
        mean_singleton_rate=("singleton_rate", "mean"),
        mean_subset_size=("mean_subset_size", "mean"),
        mean_score_expert_agreement_prob=("mean_score_expert_agreement_prob", "mean"),
        mean_rubric_observability_score=("mean_rubric_observability_score", "mean"),
        mean_rubric_discriminability_score=("mean_rubric_discriminability_score", "mean"),
        mean_tbm_conflict=("mean_tbm_conflict", "mean"),
        mean_closed_world_conflict=("mean_closed_world_conflict", "mean"),
    ).sort_values("family_slug")
    family_path = tables_dir / "family_metrics.csv"
    family_summary.to_csv(family_path, index=False)
    _record_for_all(
        connection,
        bundle.snapshot_ids,
        "table",
        family_path,
        report_name="pilot_v3_overview",
    )

    _plot_metric_heatmap(
        metrics_df,
        label_col="experiment_tag",
        title="Experiment metric overview",
        path=figures_dir / "experiment_metric_heatmap.png",
        connection=connection,
        snapshot_ids=bundle.snapshot_ids,
        report_name="pilot_v3_overview",
    )
    _plot_metric_heatmap(
        family_summary.rename(columns={"family_slug": "label"}),
        label_col="label",
        title="Family metric overview",
        path=figures_dir / "family_metric_heatmap.png",
        connection=connection,
        snapshot_ids=bundle.snapshot_ids,
        report_name="pilot_v3_overview",
    )

    summary = {
        "snapshot_ids": bundle.snapshot_ids,
        "experiment_tags": bundle.experiment_tags,
        "family_groups": family_groups_for_tags(bundle.experiment_tags),
        "response_rows": int(len(bundle.responses)),
        "rubric_rows": int(len(bundle.rubrics)),
        "evidence_rows": int(len(bundle.evidence)),
        "sample_rows": int(len(bundle.samples)),
    }
    summary_path = root / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True))
    _record_for_all(
        connection,
        bundle.snapshot_ids,
        "summary",
        summary_path,
        report_name="pilot_v3_overview",
        metadata=summary,
    )


def _build_experiment_metrics(bundle: SnapshotBundle) -> pd.DataFrame:
    responses = bundle.responses.copy()
    rubrics = bundle.rubrics.copy()

    tbm_conflict = _belief_conflict_by_tag(bundle, closed_world=False)
    closed_conflict = _belief_conflict_by_tag(bundle, closed_world=True)

    rows: list[dict[str, object]] = []
    for tag in bundle.experiment_tags:
        experiment = bundle.experiments[tag]
        response_rows = responses[responses["experiment_tag"] == tag].copy()
        rubric_rows = rubrics[rubrics["experiment_tag"] == tag].copy()
        non_abstain = response_rows[~response_rows["abstained"]]
        rows.append(
            {
                "experiment_tag": tag,
                "family_code": family_code_from_tag(tag),
                "family_slug": family_slug_from_tag(tag),
                "variant_slug": variant_slug_from_tag(tag),
                "model_id": experiment["model_id"],
                "rubric_model": experiment["rubric_model"],
                "scoring_model": experiment["scoring_model"],
                "concept": experiment["concept"],
                "scale_size": experiment["scale_size"],
                "scoring_method": experiment["scoring_method"],
                "abstain_enabled": bool(experiment["abstain_enabled"]),
                "evidence_view": experiment["evidence_view"],
                "evidence_bundle_size": experiment["evidence_bundle_size"],
                "response_rows": int(len(response_rows)),
                "rubric_rows": int(len(rubric_rows)),
                "evidence_rows": int(len(bundle.evidence[bundle.evidence["experiment_tag"] == tag])),
                "sample_rows": int(len(bundle.samples[bundle.samples["experiment_tag"] == tag])),
                "unique_bundle_count": int(response_rows["bundle_label"].nunique()),
                "abstain_rate": _safe_mean(response_rows["abstained"]),
                "singleton_rate": _safe_mean(non_abstain["decoded_scores"].apply(len).eq(1)),
                "mean_subset_size": _safe_mean(non_abstain["subset_size"]),
                "mean_score_expert_agreement_prob": _safe_mean(response_rows["score_expert_agreement_prob"]),
                "mean_rubric_observability_score": _safe_mean(rubric_rows["observability_score"]),
                "mean_rubric_discriminability_score": _safe_mean(rubric_rows["discriminability_score"]),
                "mean_tbm_conflict": float(tbm_conflict.get(tag, np.nan)),
                "mean_closed_world_conflict": float(closed_conflict.get(tag, np.nan)),
            }
        )

    return pd.DataFrame(rows).sort_values(["family_slug", "experiment_tag"]).reset_index(drop=True)


def _belief_conflict_by_tag(bundle: SnapshotBundle, *, closed_world: bool) -> pd.Series:
    belief_df = _build_belief_frame(bundle, closed_world=closed_world)
    if belief_df.empty:
        return pd.Series(dtype=float)
    return belief_df.groupby("tag")["conflict"].mean()


def _build_belief_frame(bundle: SnapshotBundle, *, closed_world: bool) -> pd.DataFrame:
    theta = frozenset(range(1, bundle.scale_size + 1))
    stages = sorted(theta)
    rows: list[dict[str, object]] = []

    for (tag, sample_ordinal), group in bundle.responses.groupby(
        ["experiment_tag", "sample_ordinal"],
        dropna=False,
    ):
        masses: list[MassFunction] = []
        for _, row in group.iterrows():
            mass = _response_to_mass(row, theta, closed_world=closed_world)
            if mass is not None:
                masses.append(mass)
        if not masses:
            continue

        if closed_world:
            combined_unnorm = masses[0]
            conflict = 0.0
            for mass in masses[1:]:
                combined_unnorm = combined_unnorm.combine_conjunctive(
                    mass,
                    normalization=False,
                )
                conflict = float(combined_unnorm[frozenset()])

            if conflict >= 0.9999:
                combined = combined_unnorm
            else:
                combined = masses[0]
                for mass in masses[1:]:
                    combined = combined.combine_conjunctive(
                        mass,
                        normalization=True,
                    )
        else:
            combined = masses[0]
            conflict = float(combined[frozenset()])
            for mass in masses[1:]:
                combined = combined.combine_conjunctive(
                    mass,
                    normalization=False,
                )
                conflict = float(combined[frozenset()])

        if conflict >= 0.9999:
            pign = {}
        else:
            pign = combined.pignistic()

        rubric_id = str(group["rubric_id"].dropna().iloc[0]) if group["rubric_id"].notna().any() else ""
        rows.append(
            {
                "method": "closed" if closed_world else "tbm",
                "tag": tag,
                "model": display_label_for_tag(bundle, tag),
                "sample_ordinal": int(sample_ordinal),
                "sample_label": f"S{int(sample_ordinal):02d}",
                "rubric_id": rubric_id,
                "n_responses": int(len(group)),
                "bundle_count": int(group["bundle_label"].nunique()),
                "abstain_count": int(group["abstained"].sum()),
                "conflict": float(conflict),
                **{
                    f"betP_{stage}": float(pign.get(frozenset([stage]), 0.0))
                    for stage in stages
                },
            }
        )

    return pd.DataFrame(rows).sort_values(["tag", "sample_ordinal"]).reset_index(drop=True)


def _plot_metric_heatmap(
    frame: pd.DataFrame,
    *,
    label_col: str,
    title: str,
    path: Path,
    connection,
    snapshot_ids: Iterable[str],
    report_name: str,
) -> None:
    available_metrics = [metric for metric in OVERVIEW_METRICS if metric in frame.columns]
    if frame.empty or not available_metrics:
        return

    heatmap = frame[[label_col, *available_metrics]].copy().set_index(label_col)
    heatmap = heatmap.astype(float)
    height = max(4, 0.45 * len(heatmap.index))
    fig, ax = plt.subplots(figsize=(12, height))
    sns.heatmap(heatmap, annot=True, fmt=".2f", cmap="mako", ax=ax)
    ax.set_title(title)
    ax.set_xlabel("Metric")
    ax.set_ylabel("")
    fig.tight_layout()
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    _record_for_all(
        connection,
        snapshot_ids,
        "figure",
        path,
        report_name=report_name,
    )


def _write_evidence_table(bundle: SnapshotBundle, tables_dir: Path, connection, report_name: str) -> None:
    path = tables_dir / "evidence.csv"
    bundle.evidence.sort_values(["experiment_tag", "label"]).to_csv(path, index=False)
    _record_for_all(connection, bundle.snapshot_ids, "table", path, report_name=report_name)


def _plot_stage_counts(bundle: SnapshotBundle, figures_dir: Path, connection, report_name: str) -> None:
    scores = bundle.responses.copy()
    scores["evidence"] = scores["bundle_label"]

    def explode_stages(row: pd.Series) -> list[int | str]:
        if row["abstained"]:
            return ["ABSTAIN"]
        return row["decoded_scores"]

    n_models = len(bundle.experiment_tags)
    if n_models == 0:
        return

    n_cols = 2
    n_rows = math.ceil(n_models / n_cols)
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(10 * n_cols, 6 * n_rows), sharey=True)
    axes = np.atleast_1d(axes).flatten()
    all_stages = list(range(1, bundle.scale_size + 1)) + ["ABSTAIN"]
    stage_colors = list(plt.cm.YlOrRd(np.linspace(0.3, 0.9, bundle.scale_size))) + [(0.7, 0.7, 0.7)]

    for idx, tag in enumerate(bundle.experiment_tags):
        ax = axes[idx]
        label = display_label_for_tag(bundle, tag)
        sub = scores[scores["experiment_tag"] == tag].copy()
        sub["stages"] = sub.apply(explode_stages, axis=1)
        exploded = sub.explode("stages")
        labels = sorted(sub["evidence"].dropna().unique().tolist())
        stage_counts = exploded.groupby(["evidence", "stages"]).size().unstack(fill_value=0)
        stage_counts = stage_counts.reindex(index=labels, columns=all_stages, fill_value=0)
        stage_counts.plot(
            kind="bar",
            stacked=True,
            ax=ax,
            color=stage_colors,
            width=0.7,
            legend=(idx == n_models - 1),
        )
        ax.set_title(label)
        ax.set_xlabel("Bundle")
        ax.set_ylabel("Count")
        ax.set_xticklabels(labels, rotation=45, ha="right")
        ax.grid(axis="y", alpha=0.3)

    for idx in range(n_models, len(axes)):
        axes[idx].set_visible(False)

    axes[n_models - 1].legend(title="Stage", bbox_to_anchor=(1.05, 1), loc="upper left")
    fig.suptitle("Subset-exploded stage counts per bundle", fontsize=14, fontweight="bold")
    fig.tight_layout()
    path = figures_dir / "subset_stage_counts.png"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    _record_for_all(connection, bundle.snapshot_ids, "figure", path, report_name=report_name)


def _run_length_bias(
    bundle: SnapshotBundle,
    tables_dir: Path,
    figures_dir: Path,
    connection,
    report_name: str,
) -> None:
    responses = bundle.responses.copy()
    rubrics = bundle.rubrics.copy()

    def word_count(text: str) -> int:
        tokens = str(text or "").split()
        return len([token for token in tokens if token])

    stage_rows: list[dict[str, object]] = []
    for _, rubric in rubrics.iterrows():
        for stage in rubric["stages"]:
            stage_rows.append(
                {
                    "rubric_id": rubric["rubric_id"],
                    "stage": stage["stage_number"],
                    "stage_len": word_count(" ".join([stage["label"], *stage["criteria"]])),
                }
            )
    stage_df = pd.DataFrame(stage_rows)
    if stage_df.empty:
        return

    stage_df["stage_len_z"] = stage_df.groupby("rubric_id")["stage_len"].transform(
        lambda series: (
            (series - series.mean()) / series.std(ddof=0)
            if series.std(ddof=0) > 0 else 0.0
        )
    )

    score_stage = responses.merge(
        rubrics[["rubric_id", "observability_score", "discriminability_score"]],
        on="rubric_id",
        how="left",
    ).merge(stage_df, on="rubric_id", how="left")
    score_stage["selected"] = score_stage.apply(
        lambda row: 0 if row["abstained"] else int(row["stage"] in row["decoded_scores"]),
        axis=1,
    )

    results: list[dict[str, object]] = []
    for tag in bundle.experiment_tags:
        sub = score_stage[
            (score_stage["experiment_tag"] == tag) & (~score_stage["abstained"])
        ].copy()
        if len(sub) < 10 or sub["selected"].nunique() < 2:
            continue
        fit = smf.ols("selected ~ stage_len_z", data=sub).fit()
        results.append(
            {
                "experiment_tag": tag,
                "model": display_label_for_tag(bundle, tag),
                "coef_stage_len_z": fit.params.get("stage_len_z", np.nan),
                "p_value": fit.pvalues.get("stage_len_z", np.nan),
                "n_rows": len(sub),
            }
        )

    result_df = pd.DataFrame(results).sort_values("model") if results else pd.DataFrame()
    csv_path = tables_dir / "rubric_length_bias.csv"
    result_df.to_csv(csv_path, index=False)
    _record_for_all(connection, bundle.snapshot_ids, "table", csv_path, report_name=report_name)

    if result_df.empty:
        return

    fig, ax = plt.subplots(figsize=(8, max(3, len(result_df) * 0.6)))
    sns.barplot(data=result_df, x="coef_stage_len_z", y="model", ax=ax, color="#c46c43")
    ax.axvline(0, color="black", linewidth=1)
    ax.set_title("Rubric stage length bias")
    ax.set_xlabel("OLS coefficient on within-rubric stage length z-score")
    ax.set_ylabel("Model")
    fig.tight_layout()
    path = figures_dir / "rubric_length_bias.png"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    _record_for_all(connection, bundle.snapshot_ids, "figure", path, report_name=report_name)


def _write_rates(
    bundle: SnapshotBundle,
    tables_dir: Path,
    figures_dir: Path,
    connection,
    report_name: str,
) -> None:
    scores = bundle.responses.copy()
    records: list[dict[str, object]] = []
    for tag in bundle.experiment_tags:
        label = display_label_for_tag(bundle, tag)
        sub = scores[scores["experiment_tag"] == tag]
        for bundle_label, group in sub.groupby("bundle_label"):
            n = len(group)
            abstain_rate = float(group["abstained"].mean()) if n else np.nan
            non_abs = group[~group["abstained"]]
            singleton_rate = (
                float(non_abs["decoded_scores"].apply(len).eq(1).mean())
                if len(non_abs) else np.nan
            )
            records.append(
                {
                    "experiment_tag": tag,
                    "model": label,
                    "bundle": bundle_label,
                    "n": n,
                    "abstain_rate": abstain_rate,
                    "singleton_rate": singleton_rate,
                }
            )
    rate_df = pd.DataFrame(records).sort_values(["model", "bundle"])
    csv_path = tables_dir / "abstain_specificity_rates.csv"
    rate_df.to_csv(csv_path, index=False)
    _record_for_all(connection, bundle.snapshot_ids, "table", csv_path, report_name=report_name)

    if rate_df.empty:
        return

    heatmap_df = rate_df.groupby(["bundle", "model"], as_index=False).agg(
        abstain_rate=("abstain_rate", "mean"),
        singleton_rate=("singleton_rate", "mean"),
    )
    fig, axes = plt.subplots(1, 2, figsize=(14, max(4, 0.35 * len(rate_df["bundle"].unique()))))
    abstain_pivot = heatmap_df.pivot(index="bundle", columns="model", values="abstain_rate")
    singleton_pivot = heatmap_df.pivot(index="bundle", columns="model", values="singleton_rate")
    sns.heatmap(abstain_pivot, annot=True, fmt=".2f", cmap="Reds", ax=axes[0], vmin=0, vmax=1)
    sns.heatmap(singleton_pivot, annot=True, fmt=".2f", cmap="Blues", ax=axes[1], vmin=0, vmax=1)
    axes[0].set_title("Abstain rate by bundle")
    axes[1].set_title("Singleton rate by bundle")
    fig.tight_layout()
    path = figures_dir / "abstain_specificity_rates.png"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    _record_for_all(connection, bundle.snapshot_ids, "figure", path, report_name=report_name)


def _write_belief_reports(
    bundle: SnapshotBundle,
    tables_dir: Path,
    figures_dir: Path,
    connection,
    report_name: str,
) -> pd.DataFrame:
    tbm_df = _build_belief_frame(bundle, closed_world=False)
    csv_path = tables_dir / "belief_tbm.csv"
    tbm_df.to_csv(csv_path, index=False)
    _record_for_all(connection, bundle.snapshot_ids, "table", csv_path, report_name=report_name)
    path = figures_dir / "belief_tbm_conflict.png"
    if _plot_conflict_summary(tbm_df, "TBM conflict by model", path):
        _record_for_all(connection, bundle.snapshot_ids, "figure", path, report_name=report_name)
    return tbm_df


def _write_closed_world_reports(
    bundle: SnapshotBundle,
    tables_dir: Path,
    figures_dir: Path,
    connection,
    report_name: str,
) -> pd.DataFrame:
    closed_df = _build_belief_frame(bundle, closed_world=True)
    csv_path = tables_dir / "belief_closed_world.csv"
    closed_df.to_csv(csv_path, index=False)
    _record_for_all(connection, bundle.snapshot_ids, "table", csv_path, report_name=report_name)
    path = figures_dir / "belief_closed_world_conflict.png"
    if _plot_conflict_summary(closed_df, "Closed-world conflict by model", path):
        _record_for_all(connection, bundle.snapshot_ids, "figure", path, report_name=report_name)
    return closed_df


def _response_to_mass(
    row: pd.Series,
    theta: frozenset[int],
    *,
    closed_world: bool,
) -> MassFunction | None:
    agreement = float(row.get("score_expert_agreement_prob") or 1.0)
    if row["abstained"]:
        if closed_world:
            return None
        mass = MassFunction()
        mass[frozenset()] = agreement
        mass[theta] = 1.0 - agreement
        return mass

    verdict = frozenset(int(stage) for stage in row["decoded_scores"])
    if verdict == theta:
        mass = MassFunction()
        if closed_world:
            mass[theta] = 1.0
        else:
            mass[theta] = agreement
            mass[frozenset()] = 1.0 - agreement
        return mass

    if closed_world:
        verdict_mass = max(0.0, min(1.0, agreement))
        return MassFunction({verdict: verdict_mass, theta: 1.0 - verdict_mass})

    verdict_mass = max(
        0.0,
        min(
            1.0,
            agreement
            * float(row.get("rubric_observability_score") or 1.0)
            * float(row.get("rubric_discriminability_score") or 1.0),
        ),
    )
    return MassFunction({verdict: verdict_mass, theta: 1.0 - verdict_mass})


def _plot_conflict_summary(df: pd.DataFrame, title: str, path: Path) -> bool:
    if df.empty:
        return False
    summary = df.groupby("model", as_index=False)["conflict"].mean().sort_values("conflict", ascending=False)
    fig, ax = plt.subplots(figsize=(8, max(3, len(summary) * 0.6)))
    sns.barplot(data=summary, x="conflict", y="model", ax=ax, color="#557a95")
    ax.set_title(title)
    ax.set_xlabel("Mean conflict")
    ax.set_ylabel("Model")
    fig.tight_layout()
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return True


def _write_divergence(
    bundle: SnapshotBundle,
    tbm_df: pd.DataFrame,
    closed_df: pd.DataFrame,
    tables_dir: Path,
    figures_dir: Path,
    connection,
    report_name: str,
) -> None:
    rows: list[dict[str, object]] = []
    for method, df in [("tbm", tbm_df), ("closed", closed_df)]:
        if df.empty:
            continue
        for sample_ordinal, sub in df.groupby("sample_ordinal"):
            for model_a, model_b in combinations(sorted(sub["model"].unique()), 2):
                a_row = sub[sub["model"] == model_a]
                b_row = sub[sub["model"] == model_b]
                if a_row.empty or b_row.empty:
                    continue
                p = np.array([float(a_row.iloc[0][f"betP_{stage}"]) for stage in range(1, bundle.scale_size + 1)])
                q = np.array([float(b_row.iloc[0][f"betP_{stage}"]) for stage in range(1, bundle.scale_size + 1)])
                rows.append(
                    {
                        "method": method,
                        "sample_ordinal": int(sample_ordinal),
                        "sample_label": f"S{int(sample_ordinal):02d}",
                        "model_a": model_a,
                        "model_b": model_b,
                        "js_divergence": _js_div(p, q),
                        "tv_distance": _tv_dist(p, q),
                    }
                )

    divergence_df = pd.DataFrame(rows)
    csv_path = tables_dir / "pairwise_divergence.csv"
    divergence_df.to_csv(csv_path, index=False)
    _record_for_all(connection, bundle.snapshot_ids, "table", csv_path, report_name=report_name)

    if divergence_df.empty:
        return

    for method, sub in divergence_df.groupby("method"):
        fig, ax = plt.subplots(figsize=(10, max(4, len(sub["sample_label"].unique()) * 0.5)))
        pivot = sub.pivot(index="sample_label", columns=["model_a", "model_b"], values="js_divergence")
        sns.heatmap(pivot, annot=True, fmt=".3f", cmap="viridis", ax=ax)
        ax.set_title(f"Pairwise JS divergence ({method})")
        fig.tight_layout()
        path = figures_dir / f"pairwise_divergence_{method}.png"
        fig.savefig(path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        _record_for_all(connection, bundle.snapshot_ids, "figure", path, report_name=report_name)


def _js_div(p: np.ndarray, q: np.ndarray, eps: float = 1e-8) -> float:
    p = _normalize_with_eps(p, eps)
    q = _normalize_with_eps(q, eps)
    m = 0.5 * (p + q)
    return float(0.5 * (_kl_div(p, m, eps) + _kl_div(q, m, eps)))


def _tv_dist(p: np.ndarray, q: np.ndarray, eps: float = 1e-8) -> float:
    p = _normalize_with_eps(p, eps)
    q = _normalize_with_eps(q, eps)
    return float(0.5 * np.abs(p - q).sum())


def _kl_div(p: np.ndarray, q: np.ndarray, eps: float) -> float:
    p = _normalize_with_eps(p, eps)
    q = _normalize_with_eps(q, eps)
    return float(np.sum(p * np.log(p / q)))


def _normalize_with_eps(p: np.ndarray, eps: float) -> np.ndarray:
    q = np.asarray(p, dtype=float) + eps
    return q / q.sum()


def _safe_mean(series: pd.Series) -> float:
    if len(series) == 0:
        return float("nan")
    return float(series.astype(float).mean())


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
