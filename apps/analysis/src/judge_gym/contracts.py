from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def resolve_repo_path(path: str | Path) -> Path:
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate
    if candidate.exists():
        return candidate.resolve()
    return (repo_root() / candidate).resolve()


def load_json(path: str | Path) -> dict[str, Any]:
    resolved = resolve_repo_path(path)
    data = json.loads(resolved.read_text())
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in {resolved}")
    return data
