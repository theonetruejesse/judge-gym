from __future__ import annotations

import argparse
import json

from .cache import connect_cache, default_cache_path, list_completed_experiment_tags
from .export import ConvexAnalysisClient, export_experiments
from .investigate_v3 import generate_v3_investigation
from .rubric_embeddings import DEFAULT_RUBRIC_EMBEDDING_MODEL
from .report_pilot import generate_pilot_report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="judge-gym-analysis")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export", help="Export completed experiment data from Convex into SQLite cache")
    export_parser.add_argument("--convex-url", required=True)
    export_parser.add_argument("--cache-db", default=str(default_cache_path()))
    export_parser.add_argument("--experiment-tag", action="append", default=[])
    export_parser.add_argument("--all-completed", action="store_true")
    export_parser.add_argument("--refresh", action="store_true")
    export_parser.add_argument("--page-size", type=int, default=200)

    report_parser = subparsers.add_parser("pilot-report", help="Generate pilot analysis artifacts from cached snapshots")
    report_parser.add_argument("--cache-db", default=str(default_cache_path()))
    report_parser.add_argument("--experiment-tag", action="append", default=[])
    report_parser.add_argument("--snapshot-id", action="append", default=[])
    report_parser.add_argument("--output-dir")

    investigate_parser = subparsers.add_parser("v3-investigate", help="Generate derived V3 analysis tables and a first-pass investigation report")
    investigate_parser.add_argument("--cache-db", default=str(default_cache_path()))
    investigate_parser.add_argument("--experiment-tag", action="append", default=[])
    investigate_parser.add_argument("--snapshot-id", action="append", default=[])
    investigate_parser.add_argument("--all-completed", action="store_true")
    investigate_parser.add_argument("--output-dir")
    investigate_parser.add_argument("--rubric-embedding-model", default=DEFAULT_RUBRIC_EMBEDDING_MODEL)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "export":
        experiment_tags = list(args.experiment_tag)
        if args.all_completed:
            client = ConvexAnalysisClient(args.convex_url)
            try:
                experiment_tags = [
                    experiment["experiment_tag"]
                    for experiment in client.list_experiments()
                    if experiment["latest_completed_run_id"] is not None
                ]
            finally:
                client.close()
        if not experiment_tags:
            raise SystemExit("Provide --experiment-tag or --all-completed")
        snapshots = export_experiments(
            experiment_tags=experiment_tags,
            deployment_url=args.convex_url,
            cache_db_path=args.cache_db,
            refresh=args.refresh,
            page_size=args.page_size,
        )
        print(json.dumps([snapshot.__dict__ for snapshot in snapshots], indent=2, sort_keys=True))
        return 0

    if args.command == "pilot-report":
        if not args.snapshot_id and not args.experiment_tag:
            raise SystemExit("Provide --snapshot-id or --experiment-tag")
        output_dir = generate_pilot_report(
            snapshot_ids=list(args.snapshot_id) or None,
            experiment_tags=list(args.experiment_tag) or None,
            cache_db_path=args.cache_db,
            output_dir=args.output_dir,
        )
        print(str(output_dir))
        return 0

    if args.command == "v3-investigate":
        experiment_tags = list(args.experiment_tag)
        if args.all_completed:
            connection = connect_cache(args.cache_db)
            try:
                experiment_tags = list_completed_experiment_tags(connection)
            finally:
                connection.close()
        if not args.snapshot_id and not experiment_tags:
            raise SystemExit("Provide --snapshot-id, --experiment-tag, or --all-completed")
        output_dir = generate_v3_investigation(
            snapshot_ids=list(args.snapshot_id) or None,
            experiment_tags=experiment_tags or None,
            cache_db_path=args.cache_db,
            output_dir=args.output_dir,
            rubric_embedding_model=args.rubric_embedding_model,
        )
        print(str(output_dir))
        return 0

    raise SystemExit(f"Unknown command: {args.command}")
