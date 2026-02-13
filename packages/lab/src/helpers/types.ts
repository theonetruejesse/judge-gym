import type {
  ModelType,
  TaskType,
  ExperimentConfig,
} from "@judge-gym/engine";

export type ExperimentSettings = {
  window: {
    start_date: string;
    end_date: string;
    country: string;
    concept: string;
  };
  experiment: {
    experiment_tag: string;
    task_type: TaskType;
    config: ExperimentConfig;
    hypothetical_frame?: string;
    label_neutralization_mode?: "none" | "mask" | "generic";
  };
  evidence_limit: number;
  sample_count: number;
};
