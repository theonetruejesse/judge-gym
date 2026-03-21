from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from .datasets import load_snapshot_bundle
from .export import export_experiments


@dataclass
class ExperimentData:
    scores: pd.DataFrame
    evidence: pd.DataFrame
    rubrics: pd.DataFrame
    experiments: dict[str, dict[str, Any]]
    tags: list[str] = field(default_factory=list)
    samples: pd.DataFrame | None = None

    @property
    def scale_size(self) -> int:
        return int(self.scores["scale_size"].dropna().iloc[0])


def pull_experiments(
    experiment_tags: list[str],
    *,
    deployment_url: str,
    cache_db_path: str | None = None,
    refresh: bool = False,
    page_size: int = 200,
) -> ExperimentData:
    export_experiments(
        experiment_tags=experiment_tags,
        deployment_url=deployment_url,
        cache_db_path=cache_db_path,
        refresh=refresh,
        page_size=page_size,
    )
    bundle = load_snapshot_bundle(
        experiment_tags=experiment_tags,
        cache_db_path=cache_db_path,
    )
    return ExperimentData(
        scores=bundle.responses,
        evidence=bundle.evidence,
        rubrics=bundle.rubrics,
        experiments=bundle.experiments,
        tags=bundle.experiment_tags,
        samples=bundle.samples,
    )
