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

/**
 * Render a human-readable, multi-line summary of an experiment configuration.
 *
 * @param config - Experiment configuration whose displayed fields include evidence view, scoring method, scale size, randomizations, prompt ordering, and abstain setting.
 * @returns A multi-line string with the following entries: `Evidence`, `Scoring`, `Scale` (formatted as `<n>-point`), `Randomize` (comma-separated values or `none`), `Ordering`, and `Abstain` (`enabled` or `disabled`).
 */
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
  ].join("\n");
}

/**
 * Render a textual checklist of experiment stages and a counts summary.
 *
 * Stages are marked completed or not based on the experiment's current status; the counts section lists sample and scoring metrics.
 *
 * @param summary - The experiment summary used to determine stage completion and to populate counts
 * @returns A newline-delimited string containing a "Stages" checklist with completion marks and a "Counts" section for Samples, Scores, Abstained, and Probes
 */
export function renderChecklist(summary: ExperimentSummary): string {
  const current = statusIndex(summary.status);
  const checks = [
    { label: "Evidence", status: "evidence-done" },
    { label: "Rubric", status: "rubric-done" },
    { label: "Scoring", status: "scoring" },
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