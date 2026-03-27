#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from collections import Counter
from pathlib import Path
from statistics import mean
from typing import Any


ROOT = Path("/Users/jesselee/dev/research/jg/judge-gym")
RUN_CONVEX = ROOT / "scripts" / "run_convex.sh"
OUTPUT_ROOT = ROOT / "_deep_workflows" / "v4-launch-r05"
RUNTIME_ROOT = OUTPUT_ROOT / "runtime"

TARGET_EXPERIMENTS = {
    "gilardi_relevance_v1_baseline_gpt41": "jh725gxfmvh19exmqk000w15pn83qmgq",
    "gilardi_relevance_v1_view_l2_neutralized_gpt41": "jh73rqc9q5emzhf03arw8js3pn83pjsv",
    "zheng_mt_bench_pair_v2_v1_baseline_gpt41": "jh7erxkt55qehvm74ybw1vtj9d83mhnk",
    "zheng_mt_bench_pair_v2_v1_abstention_on_gpt41": "jh74v1bt1ha3s2qxwq5d7y7b9183q28x",
}


def run_convex(function_name: str, args: dict[str, Any]) -> Any:
    proc = subprocess.run(
        [str(RUN_CONVEX), function_name, json.dumps(args)],
        cwd=str(ROOT),
        check=True,
        capture_output=True,
        text=True,
    )
    stdout = proc.stdout.strip()
    return json.loads(stdout) if stdout else None


def fetch_all_pages(function_name: str, run_id: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        payload = run_convex(function_name, {
            "run_id": run_id,
            "pagination": {
                "limit": 100,
                "cursor": cursor,
            },
        })
        rows.extend(payload["page"])
        if payload["is_done"]:
            return rows
        cursor = payload["continue_cursor"]


def decode_label(response: dict[str, Any]) -> str:
    if response["abstained"]:
        return "ABSTAIN"
    score = int((response.get("decoded_scores") or [0])[0])
    if response["experiment_tag"].startswith("gilardi_"):
        return {1: "Relevant", 2: "Irrelevant"}[score]
    return {1: "A", 2: "B", 3: "C"}[score]


def main() -> None:
    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    comparison_rows: list[dict[str, Any]] = []
    summary_rows: list[dict[str, Any]] = []

    for experiment_tag, experiment_id in TARGET_EXPERIMENTS.items():
        runs = run_convex("domain/runs/experiments_service:listRunsForExperiments", {
            "experiment_ids": [experiment_id],
        })
        completed = sorted(
            [row for row in runs if row["status"] == "completed"],
            key=lambda row: row["created_at"],
        )
        if len(completed) < 2:
            raise RuntimeError(f"Need at least two completed runs for {experiment_tag}")
        previous = completed[-2]
        latest = completed[-1]

        previous_rows = fetch_all_pages("packages/analysis:listAnalysisResponses", previous["run_id"])
        latest_rows = fetch_all_pages("packages/analysis:listAnalysisResponses", latest["run_id"])
        previous_by_label = {row["evidence_labels"][0]: row for row in previous_rows}
        latest_by_label = {row["evidence_labels"][0]: row for row in latest_rows}

        flips = 0
        abstain_flips = 0
        prob_deltas: list[float] = []
        label_counter_previous = Counter()
        label_counter_latest = Counter()

        for evidence_label, previous_row in previous_by_label.items():
            latest_row = latest_by_label[evidence_label]
            prev_label = decode_label(previous_row)
            next_label = decode_label(latest_row)
            label_counter_previous[prev_label] += 1
            label_counter_latest[next_label] += 1
            if prev_label != next_label:
                flips += 1
            if previous_row["abstained"] != latest_row["abstained"]:
                abstain_flips += 1
            prev_prob = previous_row.get("score_expert_agreement_prob")
            next_prob = latest_row.get("score_expert_agreement_prob")
            if prev_prob is not None and next_prob is not None:
                prob_deltas.append(float(next_prob) - float(prev_prob))
            comparison_rows.append({
                "experiment_tag": experiment_tag,
                "previous_run_id": previous["run_id"],
                "latest_run_id": latest["run_id"],
                "evidence_label": evidence_label,
                "evidence_title": previous_row["evidence_titles"][0],
                "previous_label": prev_label,
                "latest_label": next_label,
                "changed": prev_label != next_label,
                "previous_abstained": previous_row["abstained"],
                "latest_abstained": latest_row["abstained"],
            })

        n_items = len(previous_by_label)
        summary_rows.append({
            "experiment_tag": experiment_tag,
            "previous_run_id": previous["run_id"],
            "latest_run_id": latest["run_id"],
            "n_items": n_items,
            "label_flip_count": flips,
            "label_flip_rate": flips / n_items if n_items else 0.0,
            "abstain_flip_count": abstain_flips,
            "mean_expert_agreement_prob_delta": mean(prob_deltas) if prob_deltas else None,
            "previous_label_counts": dict(label_counter_previous),
            "latest_label_counts": dict(label_counter_latest),
        })

    payload = {
        "summary_rows": summary_rows,
        "comparison_rows": comparison_rows,
    }
    (RUNTIME_ROOT / "rerun_comparison.json").write_text(json.dumps(payload, indent=2, sort_keys=True))

    lines: list[str] = []
    lines.append("# V4 R05 GPT-4.1 Rerun Comparison")
    lines.append("")
    for row in summary_rows:
        lines.append(f"## `{row['experiment_tag']}`")
        lines.append("")
        lines.append(f"- Previous run: `{row['previous_run_id']}`")
        lines.append(f"- Rerun: `{row['latest_run_id']}`")
        lines.append(f"- Label flip rate: {row['label_flip_count']}/{row['n_items']} ({row['label_flip_rate'] * 100:.1f}%)")
        lines.append(f"- Previous labels: {row['previous_label_counts']}")
        lines.append(f"- Rerun labels: {row['latest_label_counts']}")
        changed = [item for item in comparison_rows if item["experiment_tag"] == row["experiment_tag"] and item["changed"]]
        if not changed:
            lines.append("- Item-level changes: none")
        else:
            lines.append("- Item-level changes:")
            for item in changed:
                lines.append(
                    f"  - `{item['evidence_label']}` {item['previous_label']} -> {item['latest_label']} ({item['evidence_title']})"
                )
        lines.append("")

    (OUTPUT_ROOT / "synthesis" / "rerun_findings.md").write_text("\n".join(lines))


if __name__ == "__main__":
    main()
