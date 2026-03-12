import z from "zod";
import {
  modelTypeSchema,
} from "../platform/providers/provider_types";

export const StateStatusSchema = z.enum([
  "start",
  "queued",
  "running",
  "paused",
  "completed",
  "error",
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

export const EvidenceGroupingConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single_evidence"),
  }),
  z.object({
    mode: z.literal("bundle"),
    bundle_size: z.union([z.number().int().min(2), z.literal("all")]),
    bundle_strategy: z.enum(["stratified_by_window", "global_random"]),
    assignment_scope: z.literal("per_run"),
    max_estimated_input_tokens: z.number().int().positive(),
  }),
]);

export type EvidenceGroupingConfig = z.infer<typeof EvidenceGroupingConfigSchema>;

export const ScoringStageConfigSchema = z.object({
  model: modelTypeSchema,
  method: z.enum(["single", "subset"]),
  abstain_enabled: z.boolean(),
  evidence_view: SemanticLevelSchema,
  randomizations: z.array(
    z.enum(["anonymize_stages", "hide_label_text", "shuffle_rubric_order"]),
  ),
  evidence_grouping: EvidenceGroupingConfigSchema,
});
