#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Any


ROOT = Path("/Users/jesselee/dev/research/jg/judge-gym")
RUN_CONVEX = ROOT / "scripts" / "run_convex.sh"
OUTPUT_ROOT = ROOT / "_deep_workflows" / "v4-launch-r04"
RUNTIME_ROOT = OUTPUT_ROOT / "runtime"

HEADLINE_TAGS = [
    "gilardi_relevance_v1_baseline_gpt41",
    "gilardi_relevance_v1_baseline_gpt52",
    "gilardi_relevance_v1_baseline_claude_sonnet4",
    "gilardi_relevance_v1_baseline_qwen",
    "zheng_mt_bench_pair_v2_v1_baseline_gpt41",
    "zheng_mt_bench_pair_v2_v1_baseline_gpt52",
    "zheng_mt_bench_pair_v2_v1_baseline_claude_sonnet4",
    "zheng_mt_bench_pair_v2_v1_baseline_qwen",
    "gilardi_relevance_v1_abstention_on_gpt41",
    "gilardi_relevance_v1_abstention_on_gpt52",
    "gilardi_relevance_v1_abstention_on_claude_sonnet4",
    "gilardi_relevance_v1_abstention_on_qwen",
    "zheng_mt_bench_pair_v2_v1_abstention_on_gpt41",
    "zheng_mt_bench_pair_v2_v1_abstention_on_gpt52",
    "zheng_mt_bench_pair_v2_v1_abstention_on_claude_sonnet4",
    "zheng_mt_bench_pair_v2_v1_abstention_on_qwen",
    "gilardi_relevance_v1_view_l2_neutralized_gpt41",
    "gilardi_relevance_v1_view_l2_neutralized_gpt52",
    "gilardi_relevance_v1_view_l2_neutralized_claude_sonnet4",
    "gilardi_relevance_v1_view_l2_neutralized_qwen",
]

GILARDI_MODEL_SUFFIX = {
    "gpt41": "gpt-4.1",
    "gpt52": "gpt-5.2",
    "claude_sonnet4": "claude-sonnet-4",
    "qwen": "qwen-current-text-flagship",
}
ZHENG_MODEL_SUFFIX = GILARDI_MODEL_SUFFIX


@dataclass
class ExperimentExport:
    tag: str
    target: str
    condition: str
    provider: str
    run_id: str
    abstain_enabled: bool
    evidence_view: str
    responses: list[dict[str, Any]]


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


def parse_tag(tag: str) -> tuple[str, str, str]:
    if tag.startswith("gilardi_relevance_v1_"):
        suffix = tag.removeprefix("gilardi_relevance_v1_")
        if suffix.startswith("baseline_"):
            return "gilardi", "baseline", GILARDI_MODEL_SUFFIX[suffix.removeprefix("baseline_")]
        if suffix.startswith("abstention_on_"):
            return "gilardi", "abstention_on", GILARDI_MODEL_SUFFIX[suffix.removeprefix("abstention_on_")]
        if suffix.startswith("view_l2_neutralized_"):
            return "gilardi", "view_l2_neutralized", GILARDI_MODEL_SUFFIX[suffix.removeprefix("view_l2_neutralized_")]
    if tag.startswith("zheng_mt_bench_pair_v2_v1_"):
        suffix = tag.removeprefix("zheng_mt_bench_pair_v2_v1_")
        if suffix.startswith("baseline_"):
            return "zheng", "baseline", ZHENG_MODEL_SUFFIX[suffix.removeprefix("baseline_")]
        if suffix.startswith("abstention_on_"):
            return "zheng", "abstention_on", ZHENG_MODEL_SUFFIX[suffix.removeprefix("abstention_on_")]
    raise ValueError(f"Unsupported experiment tag: {tag}")


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


def load_truth_maps() -> dict[str, dict[str, dict[str, Any]]]:
    result: dict[str, dict[str, dict[str, Any]]] = {
        "gilardi": {},
        "zheng": {},
    }

    gilardi_bundle = json.loads((ROOT / "_local/v4_builds/gilardi/headline_bundle.json").read_text())
    for item in gilardi_bundle["evidence_items"]:
        meta = json.loads(item["metadata_json"])
        votes = [meta.get("relevant_paula"), meta.get("relevant_fabio"), meta.get("relevant_ra")]
        relevant_votes = sum(v == "1" for v in votes)
        irrelevant_votes = sum(v == "0" for v in votes)
        truth = "Relevant" if relevant_votes >= irrelevant_votes else "Irrelevant"
        evidence_label = f"E{int(item['ordinal']) + 1}"
        result["gilardi"][evidence_label] = {
            "evidence_label": evidence_label,
            "title": item["title"],
            "truth_label": truth,
            "is_unanimous": len(set(votes)) == 1,
            "votes": votes,
        }

    zheng_bundle = json.loads((ROOT / "_local/v4_builds/zheng/headline_bundle.json").read_text())
    winner_map = {
        "model_a": "A",
        "model_b": "B",
        "tie": "C",
    }
    for item in zheng_bundle["evidence_items"]:
        meta = json.loads(item["metadata_json"])
        evidence_label = f"E{int(item['ordinal']) + 1}"
        result["zheng"][evidence_label] = {
            "evidence_label": evidence_label,
            "title": item["title"],
            "truth_label": winner_map[meta["winner"]],
            "winner": meta["winner"],
            "question_id": meta["question_id"],
            "category": meta["category"],
            "judge": meta["judge"],
            "turn": meta["turn"],
        }

    return result


def decode_label(target: str, response: dict[str, Any]) -> str:
    if response["abstained"]:
        return "ABSTAIN"
    score = int((response.get("decoded_scores") or [0])[0])
    if target == "gilardi":
        return {1: "Relevant", 2: "Irrelevant"}[score]
    return {1: "A", 2: "B", 3: "C"}[score]


def entropy(labels: list[str]) -> float:
    if not labels:
        return 0.0
    total = len(labels)
    counts = Counter(labels)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def rate(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def format_pct(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value * 100:.1f}%"


def main() -> None:
    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    truth_maps = load_truth_maps()

    exports: list[ExperimentExport] = []
    raw_rows: list[dict[str, Any]] = []
    experiment_summaries: list[dict[str, Any]] = []

    for tag in HEADLINE_TAGS:
        target, condition, provider = parse_tag(tag)
        manifest = run_convex("packages/analysis:getAnalysisManifest", {"experiment_tag": tag})
        run_id = manifest["run"]["run_id"]
        responses = fetch_all_pages("packages/analysis:listAnalysisResponses", run_id)
        exports.append(ExperimentExport(
            tag=tag,
            target=target,
            condition=condition,
            provider=provider,
            run_id=run_id,
            abstain_enabled=manifest["experiment"]["abstain_enabled"],
            evidence_view=manifest["experiment"]["evidence_view"],
            responses=responses,
        ))

        decoded_labels: list[str] = []
        agreements = 0
        truth_count = 0
        item_rows: list[dict[str, Any]] = []
        for response in responses:
            title = response["evidence_titles"][0]
            evidence_label = response["evidence_labels"][0]
            predicted = decode_label(target, response)
            truth = truth_maps[target][evidence_label]["truth_label"]
            agreed = predicted == truth
            if predicted != "ABSTAIN":
                truth_count += 1
                if agreed:
                    agreements += 1
            decoded_labels.append(predicted)
            row = {
                "experiment_tag": tag,
                "run_id": run_id,
                "target": target,
                "condition": condition,
                "provider": provider,
                "evidence_label": evidence_label,
                "evidence_title": title,
                "predicted_label": predicted,
                "truth_label": truth,
                "agreed_with_truth": agreed,
                "abstained": bool(response["abstained"]),
                "score_expert_agreement_prob": response.get("score_expert_agreement_prob"),
                "decoded_scores": response.get("decoded_scores", []),
            }
            row.update(truth_maps[target][evidence_label])
            raw_rows.append(row)
            item_rows.append(row)

        label_counts = Counter(decoded_labels)
        experiment_summaries.append({
            "experiment_tag": tag,
            "target": target,
            "condition": condition,
            "provider": provider,
            "run_id": run_id,
            "evidence_view": manifest["experiment"]["evidence_view"],
            "abstain_enabled": manifest["experiment"]["abstain_enabled"],
            "n_items": len(item_rows),
            "abstain_rate": rate(sum(1 for row in item_rows if row["abstained"]), len(item_rows)),
            "agreement_rate": rate(agreements, truth_count),
            "mean_score_expert_agreement_prob": mean(
                [row["score_expert_agreement_prob"] for row in item_rows if row["score_expert_agreement_prob"] is not None]
            ) if any(row["score_expert_agreement_prob"] is not None for row in item_rows) else None,
            "stage_entropy": entropy(decoded_labels),
            "label_counts": dict(label_counts),
        })

    # paired contrasts
    by_key = {(row["target"], row["condition"], row["provider"], row["evidence_label"]): row for row in raw_rows}
    paired_contrasts: list[dict[str, Any]] = []
    for provider in GILARDI_MODEL_SUFFIX.values():
        flips = 0
        total = 0
        agreement_deltas: list[int] = []
        abstain_deltas: list[int] = []
        for evidence_label in truth_maps["gilardi"]:
            baseline = by_key.get(("gilardi", "baseline", provider, evidence_label))
            l2 = by_key.get(("gilardi", "view_l2_neutralized", provider, evidence_label))
            if baseline and l2:
                total += 1
                if baseline["predicted_label"] != l2["predicted_label"]:
                    flips += 1
                agreement_deltas.append(int(l2["agreed_with_truth"]) - int(baseline["agreed_with_truth"]))
                abstain_deltas.append(int(l2["abstained"]) - int(baseline["abstained"]))
        paired_contrasts.append({
            "target": "gilardi",
            "contrast": "baseline_vs_l2",
            "provider": provider,
            "n_items": total,
            "flip_rate": rate(flips, total),
            "mean_agreement_delta": mean(agreement_deltas) if agreement_deltas else None,
            "mean_abstain_delta": mean(abstain_deltas) if abstain_deltas else None,
        })

    for target in ("gilardi", "zheng"):
        for provider in GILARDI_MODEL_SUFFIX.values():
            flips = 0
            total = 0
            for evidence_label in truth_maps[target]:
                baseline = by_key.get((target, "baseline", provider, evidence_label))
                abstention = by_key.get((target, "abstention_on", provider, evidence_label))
                if baseline and abstention:
                    total += 1
                    if baseline["predicted_label"] != abstention["predicted_label"]:
                        flips += 1
            paired_contrasts.append({
                "target": target,
                "contrast": "baseline_vs_abstention",
                "provider": provider,
                "n_items": total,
                "flip_rate": rate(flips, total),
            })

    # cross-provider disagreement
    disagreement_rows: list[dict[str, Any]] = []
    for target in ("gilardi", "zheng"):
        conditions = ["baseline", "abstention_on"] + (["view_l2_neutralized"] if target == "gilardi" else [])
        for condition in conditions:
            disagreement_count = 0
            total = 0
            unanimous_truth_count = 0
            all_labels: Counter[str] = Counter()
            for evidence_label, truth_meta in truth_maps[target].items():
                provider_rows = [
                    by_key.get((target, condition, provider, evidence_label))
                    for provider in GILARDI_MODEL_SUFFIX.values()
                ]
                provider_rows = [row for row in provider_rows if row is not None]
                if not provider_rows:
                    continue
                total += 1
                labels = {row["predicted_label"] for row in provider_rows}
                all_labels.update(labels)
                if len(labels) > 1:
                    disagreement_count += 1
                if target == "gilardi" and truth_meta["is_unanimous"]:
                    unanimous_truth_count += 1
            disagreement_rows.append({
                "target": target,
                "condition": condition,
                "item_disagreement_rate": rate(disagreement_count, total),
                "n_items": total,
                "panel_label_support": dict(all_labels),
                "unanimous_truth_count": unanimous_truth_count if target == "gilardi" else None,
            })

    # ranked findings
    summary_by_exp = {row["experiment_tag"]: row for row in experiment_summaries}
    findings: list[dict[str, Any]] = []
    # best/worst paper-relative agreement
    sortable = [row for row in experiment_summaries if row["agreement_rate"] is not None]
    best = max(sortable, key=lambda row: row["agreement_rate"])
    worst = min(sortable, key=lambda row: row["agreement_rate"])
    findings.append({
        "kind": "best_agreement",
        "experiment_tag": best["experiment_tag"],
        "value": best["agreement_rate"],
    })
    findings.append({
        "kind": "worst_agreement",
        "experiment_tag": worst["experiment_tag"],
        "value": worst["agreement_rate"],
    })

    # strongest l2 sensitivity
    l2_rows = [row for row in paired_contrasts if row["contrast"] == "baseline_vs_l2"]
    strongest_l2 = max(l2_rows, key=lambda row: row["flip_rate"] or -1)
    weakest_l2 = min(l2_rows, key=lambda row: row["flip_rate"] if row["flip_rate"] is not None else 999)
    findings.append({
        "kind": "strongest_l2_flip_rate",
        "provider": strongest_l2["provider"],
        "value": strongest_l2["flip_rate"],
    })
    findings.append({
        "kind": "weakest_l2_flip_rate",
        "provider": weakest_l2["provider"],
        "value": weakest_l2["flip_rate"],
    })

    # zheng tie usage
    zheng_baselines = [row for row in experiment_summaries if row["target"] == "zheng" and row["condition"] == "baseline"]
    findings.append({
        "kind": "zheng_baseline_tie_counts",
        "providers": {
            row["provider"]: row["label_counts"].get("C", 0) for row in zheng_baselines
        },
    })

    report = {
        "experiment_summaries": experiment_summaries,
        "paired_contrasts": paired_contrasts,
        "disagreement_rows": disagreement_rows,
        "findings": findings,
    }
    (RUNTIME_ROOT / "headline_analysis.json").write_text(json.dumps(report, indent=2, sort_keys=True))

    # human summary
    lines: list[str] = []
    lines.append("# V4 R04 Analysis")
    lines.append("")
    lines.append("## First-Pass Findings")
    lines.append("")
    lines.append(
        f"- Best paper-relative agreement: `{best['experiment_tag']}` at {format_pct(best['agreement_rate'])}."
    )
    lines.append(
        f"- Weakest paper-relative agreement: `{worst['experiment_tag']}` at {format_pct(worst['agreement_rate'])}."
    )

    zheng_ties = {row["provider"]: row["label_counts"].get("C", 0) for row in zheng_baselines}
    lines.append(
        "- Zheng tie usage in the baseline panel: "
        + ", ".join(f"`{provider}`={count}" for provider, count in zheng_ties.items())
        + "."
    )

    for row in l2_rows:
        lines.append(
            f"- Gilardi raw vs `l2_neutralized` flip rate for `{row['provider']}`: {format_pct(row['flip_rate'])}."
        )

    lines.append("")
    lines.append("## Experiment Summary")
    lines.append("")
    lines.append("| Experiment | Agreement | Abstain | Entropy | Labels |")
    lines.append("| --- | ---: | ---: | ---: | --- |")
    for row in sorted(experiment_summaries, key=lambda item: item["experiment_tag"]):
        labels = ", ".join(f"{label}:{count}" for label, count in sorted(row["label_counts"].items()))
        lines.append(
            f"| `{row['experiment_tag']}` | {format_pct(row['agreement_rate'])} | {format_pct(row['abstain_rate'])} | {row['stage_entropy']:.2f} | {labels} |"
        )

    lines.append("")
    lines.append("## Cross-Provider Disagreement")
    lines.append("")
    for row in disagreement_rows:
        lines.append(
            f"- `{row['target']}` / `{row['condition']}` disagreement rate: {format_pct(row['item_disagreement_rate'])} over {row['n_items']} items."
        )

    lines.append("")
    lines.append("## Immediate Interpretation")
    lines.append("")
    # dynamic interpretations
    if all(count == 0 for count in zheng_ties.values()):
        lines.append("- Zheng baseline still shows full tie suppression across the entire provider panel, not just in the GPT-4.1 canary.")
    else:
        lines.append("- Zheng baseline does not fully suppress ties; the provider panel differs in tie usage.")

    strongest_l2_agreement = max(l2_rows, key=lambda row: abs(row["mean_agreement_delta"] or 0))
    lines.append(
        f"- The strongest Gilardi view sensitivity is on `{strongest_l2['provider']}` with a {format_pct(strongest_l2['flip_rate'])} raw-vs-`l2` label flip rate."
    )

    abstention_rows = [row for row in paired_contrasts if row["contrast"] == "baseline_vs_abstention"]
    if all((row["flip_rate"] or 0) == 0 for row in abstention_rows):
        lines.append("- The abstention toggle did not change observed labels in the first-pass matrix, which suggests either the current tasks rarely trigger abstention or the prompt contract does not make abstention behaviorally available enough.")
    else:
        changed = sorted(abstention_rows, key=lambda row: row["flip_rate"] or 0, reverse=True)[0]
        lines.append(
            f"- The largest baseline-vs-abstention movement was on `{changed['target']}` / `{changed['provider']}` at {format_pct(changed['flip_rate'])}."
        )

    (OUTPUT_ROOT / "synthesis" / "analysis_findings.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
