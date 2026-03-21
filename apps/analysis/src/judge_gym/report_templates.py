from __future__ import annotations

from pathlib import Path
from typing import Iterable


def format_markdown_table(*, rows: list[dict[str, object]], columns: list[str]) -> str:
    if not rows:
        return "_No rows available._"
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join(["---"] * len(columns)) + " |"
    body_lines: list[str] = []
    for row in rows:
        values = [str(row.get(column, "")) for column in columns]
        body_lines.append("| " + " | ".join(values) + " |")
    return "\n".join([header, separator, *body_lines])


def format_bullet_lines(lines: Iterable[str]) -> str:
    normalized = [line for line in lines if line]
    if not normalized:
        return "- _None_"
    return "\n".join(f"- {line}" for line in normalized)


def format_path(path: Path) -> str:
    return str(path.as_posix())
