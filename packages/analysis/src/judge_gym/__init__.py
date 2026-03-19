"""judge-gym analysis package — export, cache, and report tooling."""

from .aggregation_methods import (
    BeliefAggregationResult,
    VerdictObservation,
    aggregate_local_closed_world,
    aggregate_local_tbm,
    geometry_support_summary,
    log_opinion_pool,
    verdict_to_stage_probabilities,
    weighted_linear_opinion_pool,
)
from .analysis_contract import load_analysis_contract, load_contract_artifacts
from .aggregation_sensitivity import (
    AggregationSensitivityOutputs,
    run_aggregation_sensitivity,
    write_aggregation_sensitivity_outputs,
)
from .collect import ExperimentData, pull_experiments
from .datasets import ContractSnapshotBundle, SnapshotBundle, load_snapshot_bundle, load_snapshot_bundle_for_contract
from .export import ConvexAnalysisClient, ExportedSnapshot, export_experiments
from .figure_triage import build_repair_plan, load_figure_manifest
from .investigate_v3 import generate_v3_investigation
from .mine_v3 import mine_v3_findings, render_markdown_summary, write_mining_summary
from .report_pilot import generate_pilot_report
from .report_v3 import assemble_v3_report

__all__ = [
    "AggregationSensitivityOutputs",
    "BeliefAggregationResult",
    "ContractSnapshotBundle",
    "ConvexAnalysisClient",
    "ExperimentData",
    "ExportedSnapshot",
    "SnapshotBundle",
    "VerdictObservation",
    "aggregate_local_closed_world",
    "aggregate_local_tbm",
    "assemble_v3_report",
    "build_repair_plan",
    "export_experiments",
    "generate_v3_investigation",
    "mine_v3_findings",
    "geometry_support_summary",
    "load_analysis_contract",
    "load_contract_artifacts",
    "load_figure_manifest",
    "generate_pilot_report",
    "load_snapshot_bundle_for_contract",
    "load_snapshot_bundle",
    "log_opinion_pool",
    "pull_experiments",
    "render_markdown_summary",
    "run_aggregation_sensitivity",
    "verdict_to_stage_probabilities",
    "write_aggregation_sensitivity_outputs",
    "write_mining_summary",
    "weighted_linear_opinion_pool",
]
