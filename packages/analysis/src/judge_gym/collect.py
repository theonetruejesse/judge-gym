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


def pull_experiment(deployment_url: str, experiment_id: str) -> pd.DataFrame:
    """Pull flat denormalized experiment data as a DataFrame."""
    rows = _query(
        deployment_url,
        "data:exportExperimentCSV",
        {
            "experimentId": experiment_id,
        },
    )
    return pd.DataFrame(rows)


def pull_summary(deployment_url: str, experiment_id: str) -> dict[str, Any]:
    """Pull experiment summary."""
    return _query(
        deployment_url,
        "data:getExperimentSummary",
        {
            "experimentId": experiment_id,
        },
    )


def pull_probes(deployment_url: str, experiment_id: str) -> pd.DataFrame:
    """Pull probe data as a DataFrame."""
    rows = _query(
        deployment_url,
        "data:listExperimentProbes",
        {
            "experimentId": experiment_id,
        },
    )
    return pd.DataFrame(rows)
