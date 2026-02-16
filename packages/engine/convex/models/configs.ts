import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import z from "zod";
import {
  ExperimentSpecInputSchema,
  ExperimentSpecNormalizedSchema,
  WindowsInputSchema,
  WindowsTableSchema,
} from "./experiments";
import { RunCountsSchema } from "./core";

export const ConfigTemplateBodySchema = z.object({
  evidence_window: WindowsTableSchema,
  experiment: ExperimentSpecNormalizedSchema,
});

export const ConfigTemplateBodyInputSchema = z.object({
  evidence_window: WindowsInputSchema,
  experiment: ExperimentSpecInputSchema,
});

export const ConfigTemplatesTableSchema = z.object({
  template_id: z.string(),
  version: z.number().int().min(1),
  schema_version: z.number().int().min(1),
  config_body: ConfigTemplateBodySchema,
  created_at: z.number(),
  created_by: z.string().optional(),
  notes: z.string().optional(),
});

export const RunConfigValidationStatusSchema = z.enum([
  "pending",
  "valid",
  "invalid",
]);

export const RunConfigsTableSchema = z.object({
  run_config_id: z.string().optional(),
  template_id: z.string(),
  version: z.number().int().min(1),
  config_body: ConfigTemplateBodySchema,
  run_counts: RunCountsSchema,
  created_at: z.number(),
  git_sha: z.string(),
  validation_status: RunConfigValidationStatusSchema,
});

export const ConfigTemplates = defineTable(
  zodOutputToConvex(ConfigTemplatesTableSchema),
);
export const RunConfigs = defineTable(zodOutputToConvex(RunConfigsTableSchema));
