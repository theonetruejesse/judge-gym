import type { ExperimentConfig, TaskType } from "../models/core";

type GroundTruth = {
  source: string;
  value?: number;
  label?: string;
};

type ExperimentSpec = {
  experiment_tag: string;
  task_type: TaskType;
  config: ExperimentConfig;
  ground_truth?: GroundTruth;
  hypothetical_frame?: string;
  label_neutralization_mode?: "none" | "mask" | "generic";
};

type WindowSpec = {
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
};

export type ExperimentSpecInput = {
  window: WindowSpec;
  experiment: ExperimentSpec;
};

function normalizeGroundTruth(ground_truth?: GroundTruth) {
  if (!ground_truth) return undefined;
  const normalized: GroundTruth = {
    source: ground_truth.source,
  };
  if (ground_truth.value !== undefined) {
    normalized.value = ground_truth.value;
  }
  if (ground_truth.label !== undefined) {
    normalized.label = ground_truth.label;
  }
  return normalized;
}

function normalizeConfig(config: ExperimentConfig) {
  return {
    scale_size: config.scale_size,
    rubric_model_id: config.rubric_model_id,
    scoring_model_id: config.scoring_model_id,
    randomizations: [...config.randomizations],
    evidence_view: config.evidence_view,
    scoring_method: config.scoring_method,
    prompt_ordering: config.prompt_ordering,
    abstain_enabled: config.abstain_enabled,
  };
}

export function buildExperimentSpecSignature(
  input: ExperimentSpecInput,
): string {
  const { window, experiment } = input;
  const normalized: {
    window: WindowSpec;
    experiment: {
      experiment_tag: string;
      task_type: TaskType;
      config: ReturnType<typeof normalizeConfig>;
      ground_truth?: GroundTruth;
      hypothetical_frame?: string;
      label_neutralization_mode?: "none" | "mask" | "generic";
    };
  } = {
    window: {
      start_date: window.start_date,
      end_date: window.end_date,
      country: window.country,
      concept: window.concept,
    },
    experiment: {
      experiment_tag: experiment.experiment_tag,
      task_type: experiment.task_type,
      config: normalizeConfig(experiment.config),
    },
  };

  if (experiment.ground_truth !== undefined) {
    normalized.experiment.ground_truth = normalizeGroundTruth(
      experiment.ground_truth,
    );
  }
  if (experiment.hypothetical_frame !== undefined) {
    normalized.experiment.hypothetical_frame = experiment.hypothetical_frame;
  }
  if (experiment.label_neutralization_mode !== undefined) {
    normalized.experiment.label_neutralization_mode =
      experiment.label_neutralization_mode;
  }

  return JSON.stringify(normalized);
}
