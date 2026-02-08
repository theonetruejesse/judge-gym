import type { ExperimentConfig } from "../../convex/schema";

export type ExperimentSummary = {
  experimentTag: string;
  windowId: string;
  modelId: string;
  concept: string;
  taskType: string;
  status: string;
  config: ExperimentConfig;
  counts: {
    samples: number;
    scores: number;
    abstained: number;
    probes: number;
  };
};

const STATUS_ORDER = [
  "pending",
  "evidence-done",
  "rubric-done",
  "scoring",
  "probing",
  "complete",
] as const;

type Status = (typeof STATUS_ORDER)[number];

function statusIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status as Status);
  return idx === -1 ? 0 : idx;
}

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
    `  Evidence   : ${config.evidenceView}`,
    `  Scoring    : ${config.scoringMethod}`,
    `  Scale      : ${config.scaleSize}-point`,
    `  Randomize  : ${randomizations}`,
    `  Ordering   : ${config.promptOrdering}`,
    `  Abstain    : ${config.abstainEnabled ? "enabled" : "disabled"}`,
    `  Probe      : ${config.freshWindowProbe ? "fresh" : "contextual"}`,
  ].join("\n");
}

export function renderChecklist(summary: ExperimentSummary): string {
  const current = statusIndex(summary.status);
  const checks = [
    { label: "Evidence", status: "evidence-done" },
    { label: "Rubric", status: "rubric-done" },
    { label: "Scoring", status: "scoring" },
    { label: "Probing", status: "probing" },
    { label: "Complete", status: "complete" },
  ].map((stage) => {
    const done = current >= statusIndex(stage.status);
    const mark = done ? "[x]" : "[ ]";
    return `  ${mark} ${stage.label}`;
  });

  return [
    "\nStages:",
    ...checks,
    "\nCounts:",
    `  Samples   : ${summary.counts.samples}`,
    `  Scores    : ${summary.counts.scores}`,
    `  Abstained : ${summary.counts.abstained}`,
    `  Probes    : ${summary.counts.probes}`,
  ].join("\n");
}

export function renderSummary(summary: ExperimentSummary): string {
  return [
    `  Experiment : ${summary.experimentTag}`,
    `  Model      : ${summary.modelId}`,
    `  Concept    : ${summary.concept}`,
    `  Task       : ${summary.taskType}`,
    `  Status     : ${summary.status}`,
  ].join("\n");
}
