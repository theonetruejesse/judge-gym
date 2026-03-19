from __future__ import annotations

import argparse
import json

from .analysis_contract import load_contract_artifacts, validate_contract_against_cache
from .aggregation_sensitivity import run_aggregation_sensitivity, write_aggregation_sensitivity_outputs
from .cache import connect_cache, default_cache_path, list_completed_experiment_tags
from .figure_triage import build_repair_plan, load_figure_manifest
from .export import ConvexAnalysisClient, export_experiments
from .investigate_v3 import generate_v3_investigation
from .mine_v3 import mine_v3_findings, write_mining_summary
from .report_v3 import assemble_v3_report
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
    investigate_parser.add_argument("--contract")
    investigate_parser.add_argument("--contrast-registry")
    investigate_parser.add_argument("--figure-manifest")

    contract_parser = subparsers.add_parser("v3-contract-check", help="Validate the frozen V3 analysis contract against the cache")
    contract_parser.add_argument("--cache-db", default=str(default_cache_path()))
    contract_parser.add_argument("--contract")
    contract_parser.add_argument("--contrast-registry")
    contract_parser.add_argument("--figure-manifest")

    figure_plan_parser = subparsers.add_parser("v3-figure-plan", help="Print the current repair plan from the frozen figure manifest")
    figure_plan_parser.add_argument("--figure-manifest")

    report_v3_parser = subparsers.add_parser("v3-report", help="Assemble a contract-driven V3 markdown report from canonical tables")
    report_v3_parser.add_argument("--contract", required=True)
    report_v3_parser.add_argument("--figure-manifest", required=True)
    report_v3_parser.add_argument("--output-path", required=True)
    report_v3_parser.add_argument("--max-rows-per-section", type=int, default=12)

    mine_parser = subparsers.add_parser("v3-mine", help="Rank findings from the frozen V3 contract tables")
    mine_parser.add_argument("--contract", required=True)
    mine_parser.add_argument("--tables-dir")
    mine_parser.add_argument("--contrast-registry")
    mine_parser.add_argument("--output-dir")

    aggregation_parser = subparsers.add_parser("v3-aggregation-sensitivity", help="Compute aggregation sensitivity tables for the frozen V3 contract")
    aggregation_parser.add_argument("--contract", required=True)
    aggregation_parser.add_argument("--cache-db", default=str(default_cache_path()))
    aggregation_parser.add_argument("--tables-dir")
    aggregation_parser.add_argument("--output-dir")

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
        if args.contract:
            output_dir = generate_v3_investigation(
                cache_db_path=args.cache_db,
                output_dir=args.output_dir,
                contract_path=args.contract,
                contrast_registry_path=args.contrast_registry,
                figures_manifest_path=args.figure_manifest,
                rubric_embedding_model=args.rubric_embedding_model,
            )
            print(str(output_dir))
            return 0
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

    if args.command == "v3-contract-check":
        artifacts = load_contract_artifacts(
            contract_path=args.contract,
            contrast_registry_path=args.contrast_registry,
            figures_manifest_path=args.figure_manifest,
        )
        connection = connect_cache(args.cache_db)
        try:
            validate_contract_against_cache(connection, artifacts.contract, artifacts.contrast_registry)
        finally:
            connection.close()
        print(
            json.dumps(
                {
                    "contract_path": str(artifacts.contract.path),
                    "snapshot_count": len(artifacts.contract.snapshot_ids),
                    "include_tag_count": len(artifacts.contract.resolved_include_tags),
                    "exclude_tag_count": len(artifacts.contract.exclude_tags),
                    "contrast_count": len(artifacts.contrast_registry.contrasts),
                    "figure_count": len(artifacts.figures_manifest.get("figures", [])),
                    "status": "ok",
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "v3-figure-plan":
        manifest = load_figure_manifest(args.figure_manifest or "_blueprints/v3-analysis-process/figures_manifest.json")
        print(json.dumps(build_repair_plan(manifest), indent=2, sort_keys=True))
        return 0

    if args.command == "v3-report":
        output_path = assemble_v3_report(
            contract_path=args.contract,
            figure_manifest_path=args.figure_manifest,
            output_path=args.output_path,
            max_rows_per_section=args.max_rows_per_section,
        )
        print(str(output_path))
        return 0

    if args.command == "v3-mine":
        mining_output = mine_v3_findings(
            contract_path=args.contract,
            tables_dir=args.tables_dir,
            contrast_registry_path=args.contrast_registry,
        )
        if args.output_dir:
            paths = write_mining_summary(mining_output, output_dir=args.output_dir)
            print(json.dumps({key: str(value) for key, value in paths.items()}, indent=2, sort_keys=True))
            return 0
        print(json.dumps(mining_output["summary"], indent=2, sort_keys=True))
        return 0

    if args.command == "v3-aggregation-sensitivity":
        outputs = run_aggregation_sensitivity(
            contract_path=args.contract,
            cache_db_path=args.cache_db,
            tables_dir=args.tables_dir,
        )
        if args.output_dir:
            paths = write_aggregation_sensitivity_outputs(outputs, output_dir=args.output_dir)
            print(json.dumps({key: str(value) for key, value in paths.items()}, indent=2, sort_keys=True))
            return 0
        print(
            json.dumps(
                {
                    "sample_methods": int(len(outputs.sample_methods)),
                    "method_summary": int(len(outputs.method_summary)),
                    "method_alignment": int(len(outputs.method_alignment)),
                    "contrast_sensitivity": int(len(outputs.contrast_sensitivity)),
                    "report_panel": int(len(outputs.report_panel)),
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    raise SystemExit(f"Unknown command: {args.command}")
