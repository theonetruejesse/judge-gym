"""
Pull experiment data from Convex into tidy DataFrames.

One HTTP call per experiment tag via ``data:exportExperimentBundle``.
Python side just reshapes the JSON—no per-table queries, no joins.

Usage::

    from judge_gym.collect import pull_experiments

    data = pull_experiments([
        "ecc-fascism-usa-trial-gpt-4.1",
        "ecc-fascism-usa-trial-gemini-3.0-flash",
    ])

    data.scores      # DataFrame — one row per score, all experiments
    data.evidence    # DataFrame — evidence_id → title + label (E1…En)
    data.experiments # dict[tag, dict] — experiment-level metadata & config
    data.scale_size  # int — ordinal scale (e.g. 4)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import httpx
import pandas as pd

# ---------------------------------------------------------------------------
# Deployment URL — resolved once at import time.
# Override with the CONVEX_URL env var if needed.
# ---------------------------------------------------------------------------
DEPLOYMENT_URL: str = os.environ.get(
    "CONVEX_URL",
    "https://patient-wolverine-343.convex.cloud",
)


# ---------------------------------------------------------------------------
# Low-level Convex HTTP helper
# ---------------------------------------------------------------------------


def _query(function_name: str, args: dict[str, Any]) -> Any:
    """Call a Convex query function via the public HTTP API."""
    resp = httpx.post(
        f"{DEPLOYMENT_URL}/api/query",
        json={"path": function_name, "args": args},
    )
    resp.raise_for_status()
    return resp.json()["value"]


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------


@dataclass
class ExperimentData:
    """Container returned by :func:`pull_experiments`."""

    scores: pd.DataFrame
    """One row per score across all requested experiments.

    Columns include experiment-level fields (experiment_tag, rubric_model_id,
    scoring_model_id, concept, task_type, config.*) plus per-score fields
    (evidence_id, abstained,
    decoded_scores, expert_agreement_prob, …).
    """

    evidence: pd.DataFrame
    """Unique evidence articles with title and short label (E1–En)."""

    rubrics: pd.DataFrame
    """Unique rubrics with stages and critic quality stats."""

    experiments: dict[str, dict[str, Any]]
    """Experiment-level metadata keyed by tag (model, concept, config, …)."""

    tags: list[str] = field(default_factory=list)
    """The experiment tags that were pulled."""

    # -- convenience helpers ------------------------------------------------

    @property
    def scale_size(self) -> int:
        """The ordinal scale size (e.g. 4) shared across experiments."""
        return int(self.scores["scale_size"].dropna().iloc[0])

    def scores_for(self, tag: str) -> pd.DataFrame:
        """Return scores filtered to a single experiment tag."""
        return self.scores[self.scores["experiment_tag"] == tag].copy()

    def label_for(self, evidence_id: str) -> str:
        """Return the short label (e.g. 'E3') for an evidence ID."""
        row = self.evidence[self.evidence["evidence_id"] == evidence_id]
        if row.empty:
            return evidence_id
        return str(row.iloc[0]["label"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _coerce_scores(vals: Any) -> list[int] | None:
    """``list[float]`` → ``list[int]``  (match integer frame of discernment)."""
    if isinstance(vals, list):
        return [int(x) for x in vals]
    return None


def _flatten_bundle(bundle: dict[str, Any]) -> pd.DataFrame:
    """Turn one ``exportExperimentBundle`` response into a flat DataFrame."""
    exp = bundle["experiment"]
    config = exp.get("config", {})
    rows = bundle["scores"]

    df = pd.DataFrame(rows)
    # Stamp experiment-level columns onto every score row
    df["experiment_tag"] = exp["experiment_tag"]
    df["rubric_model_id"] = exp.get("rubric_model_id")
    df["scoring_model_id"] = exp.get("scoring_model_id")
    df["concept"] = exp["concept"]
    df["task_type"] = exp["task_type"]
    rubric_stage = config.get("rubric_stage", {}) or {}
    scoring_stage = config.get("scoring_stage", {}) or {}
    df["scale_size"] = rubric_stage.get("scale_size")
    df["scoring_method"] = scoring_stage.get("method")
    df["evidence_view"] = scoring_stage.get("evidence_view")
    df["randomizations"] = [scoring_stage.get("randomizations")] * len(df)

    # Type coercion
    df["decoded_scores"] = df["decoded_scores"].apply(_coerce_scores)
    if "scale_size" in df.columns:
        df["scale_size"] = pd.to_numeric(
            df["scale_size"],
            errors="coerce",
        ).astype("Int64")

    return df


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def pull_experiments(experiment_tags: list[str]) -> ExperimentData:
    """Pull one or more experiments and return a tidy :class:`ExperimentData`.

    Each tag issues a single ``data:exportExperimentBundle`` query that
    returns experiment metadata, evidence titles, and flat score rows.

    Parameters
    ----------
    experiment_tags:
        List of ``experiment_tag`` strings, e.g.
        ``["ecc-fascism-usa-trial-gpt-4.1"]``.

    Returns
    -------
    ExperimentData
        Container with ``.scores``, ``.evidence``, ``.experiments``,
        and ``.tags``.
    """
    score_frames: list[pd.DataFrame] = []
    evidence_rows: list[dict[str, str]] = []
    rubric_frames: list[pd.DataFrame] = []
    experiments: dict[str, dict[str, Any]] = {}

    for tag in experiment_tags:
        bundle = _query("data:exportExperimentBundle", {"experiment_tag": tag})

        # Scores
        score_frames.append(_flatten_bundle(bundle))

        # Evidence
        for ev in bundle["evidences"]:
            evidence_rows.append(
                {
                    "evidence_id": ev["evidence_id"],
                    "title": ev["title"],
                    "url": ev.get("url", ""),
                }
            )

        # Rubrics
        if "rubrics" in bundle:
            rubric_frames.append(pd.DataFrame(bundle["rubrics"]))

        # Experiment metadata
        experiments[tag] = bundle["experiment"]

    # --- Combine DataFrames ------------------------------------------------
    scores = pd.concat(score_frames, ignore_index=True)

    # Deduplicate evidence (same articles across experiments) and assign labels
    evidence = (
        pd.DataFrame(evidence_rows)
        .drop_duplicates(subset="evidence_id")
        .sort_values("evidence_id")
        .reset_index(drop=True)
    )
    evidence["label"] = [f"E{i + 1}" for i in range(len(evidence))]

    return ExperimentData(
        scores=scores,
        evidence=evidence,
        rubrics=(
            pd.concat(rubric_frames, ignore_index=True)
            if rubric_frames
            else pd.DataFrame()
        ),
        experiments=experiments,
        tags=experiment_tags,
    )
