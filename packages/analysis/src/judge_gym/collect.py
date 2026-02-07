"""
Pull experiment data from Convex via HTTP API into DataFrames.
"""

from typing import Any

import httpx
import pandas as pd


def _query(deployment_url: str, function_name: str, args: dict[str, Any]) -> Any:
    """Call a Convex query function via the HTTP API."""
    resp = httpx.post(
        f"{deployment_url}/api/query",
        json={"path": function_name, "args": args},
    )
    resp.raise_for_status()
    return resp.json()["value"]


def pull_experiment(deployment_url: str, experiment_tag: str) -> pd.DataFrame:
    """Pull flat denormalized experiment data as a DataFrame."""
    rows = _query(
        deployment_url,
        "data:exportExperimentCSV",
        {
            "experimentTag": experiment_tag,
        },
    )
    return pd.DataFrame(rows)


def pull_summary(deployment_url: str, experiment_tag: str) -> dict[str, Any]:
    """Pull experiment summary."""
    return _query(
        deployment_url,
        "data:getExperimentSummary",
        {
            "experimentTag": experiment_tag,
        },
    )


def pull_probes(deployment_url: str, experiment_tag: str) -> pd.DataFrame:
    """Pull probe data as a DataFrame."""
    rows = _query(
        deployment_url,
        "data:listExperimentProbes",
        {
            "experimentTag": experiment_tag,
        },
    )
    return pd.DataFrame(rows)
