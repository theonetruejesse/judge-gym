import z from "zod";
import {
  ExperimentConfigSchema,
  normalizeEvidenceView,
  type ExperimentConfigInput,
} from "../models/core";
import {
  ExperimentSpecInputSchema,
  ExperimentSpecSchema,
} from "../models/experiments";
import {
  ConfigTemplateBodyInputSchema,
  ConfigTemplateBodySchema,
} from "../models/configs";

export type ExperimentSpecInput = z.infer<typeof ExperimentSpecInputSchema>;
export type ExperimentSpec = z.infer<typeof ExperimentSpecSchema>;
export type ConfigTemplateBodyInput = z.infer<typeof ConfigTemplateBodyInputSchema>;
export type ConfigTemplateBody = z.infer<typeof ConfigTemplateBodySchema>;

export function normalizeExperimentConfig(
  config: ExperimentConfigInput,
): z.infer<typeof ExperimentConfigSchema> {
  return {
    ...config,
    evidence_view: normalizeEvidenceView(config.evidence_view),
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
    experiment: normalizeExperimentSpec(body.experiment),
  };
}
