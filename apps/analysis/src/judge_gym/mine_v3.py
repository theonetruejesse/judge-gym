from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from .contracts import load_json, resolve_repo_path


DEFAULT_CONTRACT_PATH = "_blueprints/v3-analysis-process/analysis_contract.json"
REQUIRED_TABLES = (
    "family_effects_qvalues.csv",
    "candidate_findings.csv",
    "sample_instability.csv",
    "family_pair_deltas.csv",
)


def mine_v3_findings(
    *,
    contract_path: str | Path = DEFAULT_CONTRACT_PATH,
    tables_dir: str | Path | None = None,
    contrast_registry_path: str | Path | None = None,
    top_k_inferential: int = 25,
    top_k_descriptive: int = 25,
    top_k_unstable_samples: int = 10,
    top_k_effect_contributors: int = 10,
) -> dict[str, Any]:
    contract = _load_contract(contract_path)
    resolved_tables_dir = _resolve_tables_dir(contract, tables_dir=tables_dir)
    registry_payload = _load_contrast_registry(
        contract,
        contrast_registry_path=contrast_registry_path,
    )
    contrast_mode = _contrast_mode_index(registry_payload)

    tables = _load_tables(resolved_tables_dir)
    inferential = _rank_inferential_findings(
        tables["family_effects_qvalues.csv"],
        contrast_mode=contrast_mode,
        top_k=top_k_inferential,
    )
    descriptive = _rank_descriptive_findings(
        tables["candidate_findings.csv"],
        top_k=top_k_descriptive,
    )
    unstable_samples = _rank_unstable_samples(
        tables["sample_instability.csv"],
        top_k=top_k_unstable_samples,
    )
    effect_contributors = _rank_effect_contributors(
        family_pair_deltas=tables["family_pair_deltas.csv"],
        inferential_findings=inferential,
        top_k=top_k_effect_contributors,
    )
    ranked_findings = _build_ranked_findings_frame(
        inferential=inferential,
        descriptive=descriptive,
    )
    summary = _build_machine_summary(
        contract_path=resolve_repo_path(contract_path),
        tables_dir=resolved_tables_dir,
        inferential=inferential,
        descriptive=descriptive,
        unstable_samples=unstable_samples,
        effect_contributors=effect_contributors,
        ranked_findings=ranked_findings,
    )
    return {
        "contract": contract,
        "tables_dir": resolved_tables_dir,
        "contrast_registry": registry_payload,
        "ranked_findings": ranked_findings,
        "top_inferential_findings": inferential,
        "top_descriptive_findings": descriptive,
        "top_unstable_samples": unstable_samples,
        "top_effect_contributors": effect_contributors,
        "summary": summary,
    }


def render_markdown_summary(
    mining_output: dict[str, Any],
    *,
    top_k: int = 10,
) -> str:
    summary = mining_output["summary"]
    inferential = _as_frame(mining_output["top_inferential_findings"]).head(top_k)
    descriptive = _as_frame(mining_output["top_descriptive_findings"]).head(top_k)
    unstable = _as_frame(mining_output["top_unstable_samples"]).head(top_k)
    effect = _as_frame(mining_output["top_effect_contributors"]).head(top_k)

    lines: list[str] = []
    lines.append("# V3 Stats Mining Summary")
    lines.append("")
    lines.append("## Metadata")
    lines.append(f"- contract_path: `{summary['contract_path']}`")
    lines.append(f"- tables_dir: `{summary['tables_dir']}`")
    lines.append(f"- ranked_findings_count: {summary['counts']['ranked_findings']}")
    lines.append("")
    lines.append("## Top Inferential Findings")
    lines.extend(_frame_as_markdown_bullets(inferential, inferential=True))
    lines.append("")
    lines.append("## Top Descriptive Findings")
    lines.extend(_frame_as_markdown_bullets(descriptive, inferential=False))
    lines.append("")
    lines.append("## Spot Checks: Unstable Samples")
    lines.extend(_sample_markdown_bullets(unstable))
    lines.append("")
    lines.append("## Spot Checks: Effect-Contributing Samples")
    lines.extend(_effect_markdown_bullets(effect))
    lines.append("")
    lines.append("## Notes")
    lines.append("- `finding_scope` values are explicitly labeled as `inferential` or `descriptive`.")
    lines.append("- Inferential rankings are ordered by q-value significance then effect magnitude.")
    lines.append("- Descriptive rankings are sorted by absolute descriptive score.")
    return "\n".join(lines) + "\n"


def write_mining_summary(
    mining_output: dict[str, Any],
    *,
    output_dir: str | Path,
    markdown_name: str = "mine_v3_summary.md",
    findings_name: str = "mine_v3_ranked_findings.csv",
    summary_name: str = "mine_v3_summary.json",
) -> dict[str, Path]:
    resolved_output_dir = resolve_repo_path(output_dir)
    resolved_output_dir.mkdir(parents=True, exist_ok=True)

    findings_path = resolved_output_dir / findings_name
    markdown_path = resolved_output_dir / markdown_name
    summary_path = resolved_output_dir / summary_name

    ranked_findings = _as_frame(mining_output["ranked_findings"])
    ranked_findings.to_csv(findings_path, index=False)
    markdown_path.write_text(render_markdown_summary(mining_output))
    summary_path.write_text(json.dumps(mining_output["summary"], indent=2, sort_keys=True) + "\n")
    return {
        "ranked_findings_csv": findings_path,
        "summary_markdown": markdown_path,
        "summary_json": summary_path,
    }


def _load_contract(contract_path: str | Path) -> dict[str, Any]:
    return load_json(resolve_repo_path(contract_path))


def _resolve_tables_dir(contract: dict[str, Any], *, tables_dir: str | Path | None) -> Path:
    if tables_dir is not None:
        resolved = resolve_repo_path(tables_dir)
    else:
        outputs = contract.get("outputs")
        if not isinstance(outputs, dict) or "investigationRoot" not in outputs:
            raise ValueError("contract is missing outputs.investigationRoot")
        resolved = resolve_repo_path(str(outputs["investigationRoot"])) / "tables"
    if not resolved.exists():
        raise FileNotFoundError(f"investigation tables directory does not exist: {resolved}")
    return resolved


def _load_contrast_registry(
    contract: dict[str, Any],
    *,
    contrast_registry_path: str | Path | None,
) -> dict[str, Any]:
    if contrast_registry_path is not None:
        return load_json(resolve_repo_path(contrast_registry_path))
    contract_registry = contract.get("contrastRegistry")
    if not isinstance(contract_registry, dict) or "path" not in contract_registry:
        raise ValueError("contract is missing contrastRegistry.path")
    return load_json(resolve_repo_path(str(contract_registry["path"])))


def _contrast_mode_index(registry_payload: dict[str, Any]) -> dict[str, str]:
    rows = registry_payload.get("contrasts")
    if not isinstance(rows, list):
        return {}
    index: dict[str, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        contrast_id = row.get("contrastId")
        if contrast_id is None:
            continue
        mode = row.get("mode", "inferential")
        index[str(contrast_id)] = str(mode)
    return index


def _load_tables(tables_dir: Path) -> dict[str, pd.DataFrame]:
    loaded: dict[str, pd.DataFrame] = {}
    for table_name in REQUIRED_TABLES:
        path = tables_dir / table_name
        if not path.exists():
            raise FileNotFoundError(f"required table missing: {path}")
        loaded[table_name] = pd.read_csv(path)
    return loaded


def _rank_inferential_findings(
    family_effects_qvalues: pd.DataFrame,
    *,
    contrast_mode: dict[str, str],
    top_k: int,
) -> pd.DataFrame:
    if family_effects_qvalues.empty:
        return pd.DataFrame(columns=_ranked_finding_columns())

    frame = family_effects_qvalues.copy()
    frame["contrast_id"] = frame["contrast_id"].astype(str)
    frame["finding_scope"] = frame["contrast_id"].map(contrast_mode).fillna("inferential")
    frame = frame[frame["finding_scope"] == "inferential"].copy()
    if frame.empty:
        return pd.DataFrame(columns=_ranked_finding_columns())

    frame["qvalue"] = pd.to_numeric(frame["qvalue"], errors="coerce")
    frame["effect_size_dz"] = pd.to_numeric(frame["effect_size_dz"], errors="coerce")
    frame["mean_delta"] = pd.to_numeric(frame["mean_delta"], errors="coerce")
    frame["abs_effect_size_dz"] = frame["effect_size_dz"].abs()
    frame["abs_mean_delta"] = frame["mean_delta"].abs()
    frame["is_significant_fdr_05"] = frame["is_significant_fdr_05"].fillna(False).astype(bool)
    frame["is_significant_fdr_10"] = frame["is_significant_fdr_10"].fillna(False).astype(bool)
    frame["rank_score"] = (
        frame["is_significant_fdr_05"].astype(int) * 3
        + frame["is_significant_fdr_10"].astype(int) * 2
        + frame["abs_effect_size_dz"].fillna(0.0)
        + 0.1 * frame["abs_mean_delta"].fillna(0.0)
    )
    frame["finding_id"] = (
        "inferential:"
        + frame["contrast_id"].astype(str)
        + ":"
        + frame["endpoint"].astype(str)
    )
    frame["finding_label"] = (
        frame["contrast_id"].astype(str)
        + " | "
        + frame["endpoint"].astype(str)
    )
    frame["finding_type"] = "effect_qvalue"
    frame["direction"] = frame["mean_delta"].apply(_direction_label)
    frame["summary"] = frame.apply(
        lambda row: (
            f"{row['contrast_id']} | {row['endpoint']} "
            f"(delta={row['mean_delta']:.3f}, dz={row['effect_size_dz']:.3f}, q={row['qvalue']:.4f})"
        ),
        axis=1,
    )
    ranked = frame.sort_values(
        by=[
            "qvalue",
            "is_significant_fdr_05",
            "is_significant_fdr_10",
            "abs_effect_size_dz",
            "abs_mean_delta",
        ],
        ascending=[True, False, False, False, False],
    ).head(top_k)
    return ranked[_ranked_finding_columns()].reset_index(drop=True)


def _rank_descriptive_findings(
    candidate_findings: pd.DataFrame,
    *,
    top_k: int,
) -> pd.DataFrame:
    if candidate_findings.empty:
        return pd.DataFrame(columns=_ranked_finding_columns())

    frame = candidate_findings.copy()
    frame["finding_kind"] = frame["finding_kind"].astype(str)
    frame = frame[frame["finding_kind"] != "family_effect"].copy()
    if frame.empty:
        return pd.DataFrame(columns=_ranked_finding_columns())

    frame["finding_scope"] = "descriptive"
    frame["score"] = pd.to_numeric(frame["score"], errors="coerce")
    frame["rank_score"] = frame["score"].abs()
    frame["finding_id"] = (
        "descriptive:"
        + frame["finding_kind"].astype(str)
        + ":"
        + frame["subject"].astype(str)
    )
    frame["finding_label"] = (
        frame["finding_kind"].astype(str)
        + " | "
        + frame["subject"].astype(str)
    )
    frame["finding_type"] = frame["finding_kind"].astype(str)
    frame["contrast_id"] = pd.NA
    frame["endpoint"] = pd.NA
    frame["qvalue"] = pd.NA
    frame["direction"] = frame["score"].apply(_direction_label)
    ranked = frame.sort_values(
        by=["rank_score"],
        ascending=[False],
    ).head(top_k)
    ranked = ranked.rename(columns={"subject": "subject_id"})
    return ranked[_ranked_finding_columns()].reset_index(drop=True)


def _rank_unstable_samples(sample_instability: pd.DataFrame, *, top_k: int) -> pd.DataFrame:
    if sample_instability.empty:
        return sample_instability
    frame = sample_instability.copy()
    frame["instability_score"] = pd.to_numeric(frame["instability_score"], errors="coerce")
    frame = frame.sort_values("instability_score", ascending=False).head(top_k).reset_index(drop=True)
    return frame


def _rank_effect_contributors(
    *,
    family_pair_deltas: pd.DataFrame,
    inferential_findings: pd.DataFrame,
    top_k: int,
) -> pd.DataFrame:
    if family_pair_deltas.empty or inferential_findings.empty:
        return pd.DataFrame(
            columns=[
                "sample_ordinal",
                "total_abs_contribution",
                "max_abs_contribution",
                "contribution_count",
                "top_contributing_effect",
            ],
        )

    contributors: list[pd.DataFrame] = []
    for row in inferential_findings.itertuples(index=False):
        contrast_id = str(getattr(row, "contrast_id"))
        endpoint = str(getattr(row, "endpoint"))
        delta_column = f"{endpoint}_delta"
        if delta_column not in family_pair_deltas.columns:
            continue
        subset = family_pair_deltas.loc[
            family_pair_deltas["contrast_id"].astype(str) == contrast_id,
            ["sample_ordinal", "contrast_id", delta_column],
        ].copy()
        if subset.empty:
            continue
        subset = subset.rename(columns={delta_column: "delta_value"})
        subset["endpoint"] = endpoint
        subset["abs_delta"] = pd.to_numeric(subset["delta_value"], errors="coerce").abs()
        subset["effect_key"] = (
            subset["contrast_id"].astype(str) + " | " + subset["endpoint"].astype(str)
        )
        contributors.append(subset)

    if not contributors:
        return pd.DataFrame(
            columns=[
                "sample_ordinal",
                "total_abs_contribution",
                "max_abs_contribution",
                "contribution_count",
                "top_contributing_effect",
            ],
        )

    all_contrib = pd.concat(contributors, ignore_index=True)
    all_contrib = all_contrib.dropna(subset=["abs_delta"])
    if all_contrib.empty:
        return pd.DataFrame(
            columns=[
                "sample_ordinal",
                "total_abs_contribution",
                "max_abs_contribution",
                "contribution_count",
                "top_contributing_effect",
            ],
        )

    idx = all_contrib.groupby("sample_ordinal")["abs_delta"].idxmax()
    top_effect = all_contrib.loc[idx, ["sample_ordinal", "effect_key"]].rename(
        columns={"effect_key": "top_contributing_effect"},
    )
    summary = (
        all_contrib.groupby("sample_ordinal", as_index=False)
        .agg(
            total_abs_contribution=("abs_delta", "sum"),
            max_abs_contribution=("abs_delta", "max"),
            contribution_count=("abs_delta", "count"),
        )
        .merge(top_effect, on="sample_ordinal", how="left")
        .sort_values(
            by=["total_abs_contribution", "max_abs_contribution", "contribution_count"],
            ascending=[False, False, False],
        )
        .head(top_k)
        .reset_index(drop=True)
    )
    return summary


def _build_ranked_findings_frame(
    *,
    inferential: pd.DataFrame,
    descriptive: pd.DataFrame,
) -> pd.DataFrame:
    frames = [frame for frame in (inferential, descriptive) if not frame.empty]
    if not frames:
        return pd.DataFrame(columns=_ranked_finding_columns())
    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values(
        by=["finding_scope", "rank_score"],
        ascending=[True, False],
        kind="stable",
    ).reset_index(drop=True)
    return combined


def _build_machine_summary(
    *,
    contract_path: Path,
    tables_dir: Path,
    inferential: pd.DataFrame,
    descriptive: pd.DataFrame,
    unstable_samples: pd.DataFrame,
    effect_contributors: pd.DataFrame,
    ranked_findings: pd.DataFrame,
) -> dict[str, Any]:
    return {
        "contract_path": str(contract_path),
        "tables_dir": str(tables_dir),
        "counts": {
            "inferential_findings": int(len(inferential)),
            "descriptive_findings": int(len(descriptive)),
            "unstable_samples": int(len(unstable_samples)),
            "effect_contributors": int(len(effect_contributors)),
            "ranked_findings": int(len(ranked_findings)),
        },
        "top_inferential": inferential.head(10).to_dict(orient="records"),
        "top_descriptive": descriptive.head(10).to_dict(orient="records"),
        "top_unstable_samples": unstable_samples.head(10).to_dict(orient="records"),
        "top_effect_contributors": effect_contributors.head(10).to_dict(orient="records"),
    }


def _frame_as_markdown_bullets(frame: pd.DataFrame, *, inferential: bool) -> list[str]:
    if frame.empty:
        return ["- none"]
    lines: list[str] = []
    for row in frame.itertuples(index=False):
        if inferential:
            lines.append(
                "- "
                + f"`{row.finding_label}` [{row.finding_scope}] "
                + f"q={_fmt(row.qvalue)} dz={_fmt(row.rank_score)} "
                + f"dir={row.direction}"
            )
        else:
            lines.append(
                "- "
                + f"`{row.finding_label}` [{row.finding_scope}] "
                + f"score={_fmt(row.rank_score)} dir={row.direction}"
            )
    return lines


def _sample_markdown_bullets(frame: pd.DataFrame) -> list[str]:
    if frame.empty:
        return ["- none"]
    lines: list[str] = []
    for row in frame.itertuples(index=False):
        sample = getattr(row, "sample_ordinal", "n/a")
        score = getattr(row, "instability_score", float("nan"))
        lines.append(f"- sample `{sample}` instability={_fmt(score)}")
    return lines


def _effect_markdown_bullets(frame: pd.DataFrame) -> list[str]:
    if frame.empty:
        return ["- none"]
    lines: list[str] = []
    for row in frame.itertuples(index=False):
        lines.append(
            "- "
            + f"sample `{row.sample_ordinal}` total_abs={_fmt(row.total_abs_contribution)} "
            + f"top_effect=`{row.top_contributing_effect}`"
        )
    return lines


def _ranked_finding_columns() -> list[str]:
    return [
        "finding_id",
        "finding_scope",
        "finding_type",
        "finding_label",
        "contrast_id",
        "endpoint",
        "qvalue",
        "rank_score",
        "direction",
        "summary",
    ]


def _direction_label(value: Any) -> str:
    numeric = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(numeric):
        return "neutral"
    if numeric > 0:
        return "positive"
    if numeric < 0:
        return "negative"
    return "neutral"


def _fmt(value: Any) -> str:
    numeric = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(numeric):
        return "nan"
    return f"{float(numeric):.4f}"


def _as_frame(value: Any) -> pd.DataFrame:
    if isinstance(value, pd.DataFrame):
        return value
    return pd.DataFrame(value)
