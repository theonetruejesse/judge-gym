import z from "zod";
import {
  modelTypeSchema,
  providerTypeSchema,
} from "../platform/providers/provider_types";

export { modelTypeSchema, providerTypeSchema };
export type {
  ModelType,
  ProviderType,
} from "../platform/providers/provider_types";

export const StateStatusSchema = z.enum([
  "start",
  "queued",
  "running",
  "paused",
  "completed",
  "canceled",
]);

export type StateStatus = z.infer<typeof StateStatusSchema>;

export const SemanticLevelSchema = z.enum([
  "l0_raw",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
]);

export type SemanticLevel = z.infer<typeof SemanticLevelSchema>;

export const RubricStageConfigSchema = z.object({
  model: modelTypeSchema,
  scale_size: z.number(),
  concept: z.string(),
});

export const ScoringStageConfigSchema = z.object({
  model: modelTypeSchema,
  method: z.enum(["single", "subset"]),
  abstain_enabled: z.boolean(),
  evidence_view: SemanticLevelSchema,
  randomizations: z.array(
    z.enum(["anonymize_stages", "hide_label_text", "shuffle_rubric_order"]),
  ),
});
