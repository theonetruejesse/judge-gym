from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from judge_gym.cache import default_cache_path
from judge_gym.export import ConvexAnalysisClient, export_experiments
from judge_gym.investigate_v3 import default_investigation_root, generate_v3_investigation
from judge_gym.report_pilot import default_output_root, generate_v3_report_suite
from judge_gym.rubric_embeddings import DEFAULT_RUBRIC_EMBEDDING_MODEL

DEFAULT_CONVEX_URL = os.environ.get(
    "CONVEX_URL",
    "https://first-perch-454.convex.cloud",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export completed Convex experiments into SQLite and generate the full V3 analysis suite.",
    )
    parser.add_argument("--convex-url", default=DEFAULT_CONVEX_URL)
    parser.add_argument("--cache-db", default=str(default_cache_path()))
    parser.add_argument("--output-root", default=str(default_output_root()))
    parser.add_argument("--investigation-root", default=str(default_investigation_root()))
    parser.add_argument("--experiment-tag", action="append", default=[])
    parser.add_argument("--all-completed", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-investigation", action="store_true")
    parser.add_argument("--page-size", type=int, default=200)
    parser.add_argument("--rubric-embedding-model", default=DEFAULT_RUBRIC_EMBEDDING_MODEL)
    return parser


def resolve_experiment_tags(convex_url: str, explicit_tags: list[str], all_completed: bool) -> list[str]:
    if explicit_tags:
        return explicit_tags
    if not all_completed:
        raise SystemExit("Provide --experiment-tag or --all-completed")

    client = ConvexAnalysisClient(convex_url)
    try:
        return [
            experiment["experiment_tag"]
            for experiment in client.list_experiments()
            if experiment["latest_completed_run_id"] is not None
        ]
    finally:
        client.close()


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    experiment_tags = resolve_experiment_tags(
        args.convex_url,
        list(args.experiment_tag),
        args.all_completed,
    )

    snapshots = export_experiments(
        experiment_tags=experiment_tags,
        deployment_url=args.convex_url,
        cache_db_path=args.cache_db,
        refresh=args.refresh,
        page_size=args.page_size,
    )
    report_dir = generate_v3_report_suite(
        experiment_tags=experiment_tags,
        cache_db_path=args.cache_db,
        output_dir=Path(args.output_root),
    )
    investigation_dir = None
    if not args.skip_investigation:
        investigation_dir = generate_v3_investigation(
            experiment_tags=experiment_tags,
            cache_db_path=args.cache_db,
            output_dir=Path(args.investigation_root),
            rubric_embedding_model=args.rubric_embedding_model,
        )

    print(
        json.dumps(
            {
                "cache_db": str(Path(args.cache_db).resolve()),
                "output_dir": str(report_dir.resolve()),
                "investigation_dir": None if investigation_dir is None else str(investigation_dir.resolve()),
                "experiment_tags": experiment_tags,
                "snapshot_ids": [snapshot.snapshot_id for snapshot in snapshots],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
