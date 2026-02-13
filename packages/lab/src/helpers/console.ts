import type { ExperimentConfig } from "@judge-gym/engine";

export type RunStageSummary = {
  stage: string;
  status: string;
  total_requests: number;
  completed_requests: number;
  failed_requests: number;
};

export type RunSummary = {
  run_id: string;
  experiment_tag: string;
  rubric_model_id: string;
  scoring_model_id: string;
  concept: string;
  task_type: string;
  status: string;
  desired_state: string;
  current_stage?: string;
  stop_at_stage?: string;
  config: ExperimentConfig;
  counts: {
    samples: number;
    scores: number;
    abstained: number;
    critics: number;
  };
  stages: RunStageSummary[];
};

export function renderHeader(title: string): string {
  return [
    "╔══════════════════════════════════════════╗",
    `║ ${title.padEnd(38)} ║`,
    "╚══════════════════════════════════════════╝",
    "",
  ].join("\n");
}

export function renderConfigSummary(config: ExperimentConfig): string {
  const randomizations =
    config.randomizations.length > 0
      ? config.randomizations.join(", ")
      : "none";
  return [
    `  Evidence   : ${config.evidence_view}`,
    `  Scoring    : ${config.scoring_method}`,
    `  Scale      : ${config.scale_size}-point`,
    `  Randomize  : ${randomizations}`,
    `  Ordering   : ${config.prompt_ordering}`,
    `  Abstain    : ${config.abstain_enabled ? "enabled" : "disabled"}`,
  ].join("\n");
}

export function renderChecklist(summary: RunSummary): string {
  const checks = summary.stages.map((stage) => {
    const mark = stage.status === "complete" ? "[x]" : "[ ]";
    const progress = `${stage.completed_requests}/${stage.total_requests}`;
    const failed =
      stage.failed_requests > 0 ? ` (failed: ${stage.failed_requests})` : "";
    return `  ${mark} ${stage.stage} — ${progress}${failed}`;
  });

  return [
    "\nStages:",
    ...checks,
    "\nCounts:",
    `  Samples   : ${summary.counts.samples}`,
    `  Scores    : ${summary.counts.scores}`,
    `  Abstained : ${summary.counts.abstained}`,
    `  Critics   : ${summary.counts.critics}`,
  ].join("\n");
}

export function renderSummary(summary: RunSummary): string {
  return [
    `  Run        : ${summary.run_id}`,
    `  Experiment : ${summary.experiment_tag}`,
    `  Rubric     : ${summary.rubric_model_id}`,
    `  Scoring    : ${summary.scoring_model_id}`,
    `  Concept    : ${summary.concept}`,
    `  Task       : ${summary.task_type}`,
    `  Status     : ${summary.status}`,
    `  Desired    : ${summary.desired_state}`,
  ].join("\n");
}
