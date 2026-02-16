import z from "zod";
import {
  ExperimentConfigSchema,
  normalizeEvidenceView,
  type ExperimentConfigInput,
} from "../models/core";
import {
  ExperimentSpecInputSchema,
  ExperimentSpecNormalizedSchema,
} from "../models/experiments";

export type ExperimentSpecInput = z.infer<typeof ExperimentSpecInputSchema>;
export type ExperimentSpec = z.infer<typeof ExperimentSpecNormalizedSchema>;

export function normalizeExperimentConfig(
  config: ExperimentConfigInput,
): z.infer<typeof ExperimentConfigSchema> {
  return {
    ...config,
    scoring_stage: {
      ...config.scoring_stage,
      evidence_view: normalizeEvidenceView(config.scoring_stage.evidence_view),
    },
  };
}

export function normalizeExperimentSpec(
  spec: ExperimentSpecInput,
): ExperimentSpec {
  return {
    ...spec,
    config: normalizeExperimentConfig(spec.config),
  };
}
