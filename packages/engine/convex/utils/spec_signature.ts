import type { ExperimentConfigInput, TaskType } from "../models/core";
import { normalizeEvidenceView } from "../models/core";

type ExperimentSpec = {
  task_type: TaskType;
  config: ExperimentConfigInput;
};

type EvidenceWindowSpec = {
  start_date: string;
  end_date: string;
  country: string;
  concept: string;
  model_id: ExperimentConfigInput["rubric_stage"]["model_id"];
};

export type ExperimentSpecInput = {
  evidence_window: EvidenceWindowSpec;
  experiment: ExperimentSpec;
};

function normalizeConfig(config: ExperimentConfigInput) {
  return {
    rubric_stage: {
      scale_size: config.rubric_stage.scale_size,
      model_id: config.rubric_stage.model_id,
    },
    scoring_stage: {
      model_id: config.scoring_stage.model_id,
      method: config.scoring_stage.method,
      sample_count: config.scoring_stage.sample_count,
      evidence_cap: config.scoring_stage.evidence_cap,
      randomizations: [...config.scoring_stage.randomizations],
      evidence_view: normalizeEvidenceView(config.scoring_stage.evidence_view),
      abstain_enabled: config.scoring_stage.abstain_enabled,
    },
  };
}

export function buildExperimentSpecSignature(
  input: ExperimentSpecInput,
): string {
  const { evidence_window, experiment } = input;
  const normalized: {
    evidence_window: EvidenceWindowSpec;
    experiment: {
      task_type: TaskType;
      config: ReturnType<typeof normalizeConfig>;
    };
  } = {
    evidence_window: {
      start_date: evidence_window.start_date,
      end_date: evidence_window.end_date,
      country: evidence_window.country,
      concept: evidence_window.concept,
      model_id: evidence_window.model_id,
    },
    experiment: {
      task_type: experiment.task_type,
      config: normalizeConfig(experiment.config),
    },
  };

  return JSON.stringify(normalized);
}
