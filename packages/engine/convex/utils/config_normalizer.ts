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
import {
  ConfigTemplateBodyInputSchema,
  ConfigTemplateBodySchema,
} from "../models/configs";
import { buildWindowTag } from "./tags";

export type ExperimentSpecInput = z.infer<typeof ExperimentSpecInputSchema>;
export type ExperimentSpec = z.infer<typeof ExperimentSpecNormalizedSchema>;
export type ConfigTemplateBodyInput = z.infer<typeof ConfigTemplateBodyInputSchema>;
export type ConfigTemplateBody = z.infer<typeof ConfigTemplateBodySchema>;

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

export function normalizeConfigTemplateBody(
  body: ConfigTemplateBodyInput,
): ConfigTemplateBody {
  return {
    ...body,
    evidence_window: {
      ...body.evidence_window,
      window_tag: buildWindowTag(body.evidence_window),
    },
    experiment: normalizeExperimentSpec(body.experiment),
  };
}
