import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import z from "zod";
import {
  PolicyOverridesSchema,
} from "./core";
import {
  ExperimentSpecSchema,
  ExperimentSpecInputSchema,
  WindowsTableSchema,
} from "./experiments";

export const ConfigTemplateBodySchema = z.object({
  window: WindowsTableSchema,
  experiment: ExperimentSpecSchema,
  policies: PolicyOverridesSchema,
  team_id: z.string().optional(),
});

export const ConfigTemplateBodyInputSchema = ConfigTemplateBodySchema.extend({
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
  spec_signature: z.string(),
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
  created_at: z.number(),
  git_sha: z.string(),
  spec_signature: z.string(),
  validation_status: RunConfigValidationStatusSchema,
});

export const ConfigTemplates = defineTable(
  zodOutputToConvex(ConfigTemplatesTableSchema),
);
export const RunConfigs = defineTable(zodOutputToConvex(RunConfigsTableSchema));
