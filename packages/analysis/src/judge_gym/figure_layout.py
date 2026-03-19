from __future__ import annotations

import math
import re
from collections.abc import Iterable


_VERDICT_PATTERN = re.compile(r"-?\d+")


def parse_verdict_label(label: str) -> tuple[int, ...]:
    """Parse labels like "[2,3]" into an ordered tuple of stage ids."""
    if not label:
        return ()
    values = tuple(int(value) for value in _VERDICT_PATTERN.findall(label))
    if not values:
        return ()
    return tuple(sorted(set(values)))


def bucket_verdict_label(label: str) -> str:
    """
    Bucket subset verdict labels into report-friendly categories.

    Categories:
    - abstain
    - singleton
    - adjacent_subset
    - non_adjacent_subset
    - broad_subset
    - unknown
    """
    verdict = parse_verdict_label(label)
    if not verdict:
        return "abstain"
    if len(verdict) == 1:
        return "singleton"
    if len(verdict) >= 3:
        return "broad_subset"
    first, second = verdict
    if second - first == 1:
        return "adjacent_subset"
    return "non_adjacent_subset"


def bucket_verdict_labels(labels: Iterable[str]) -> list[str]:
    return [bucket_verdict_label(label) for label in labels]


def should_annotate_heatmap(
    *,
    row_count: int,
    column_count: int,
    max_cells_for_annotations: int = 120,
) -> bool:
    if row_count <= 0 or column_count <= 0:
        return False
    return row_count * column_count <= max_cells_for_annotations


def paginate_labels(labels: list[str], *, page_size: int) -> list[list[str]]:
    if page_size <= 0:
        raise ValueError("page_size must be > 0")
    return [labels[index : index + page_size] for index in range(0, len(labels), page_size)]


def suggest_facet_grid(panel_count: int, *, max_columns: int = 4) -> tuple[int, int]:
    if panel_count <= 0:
        return (0, 0)
    columns = min(max_columns, panel_count)
    rows = math.ceil(panel_count / columns)
    return rows, columns

