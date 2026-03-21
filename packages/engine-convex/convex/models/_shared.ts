import z from "zod";
import {
  modelTypeSchema,
} from "@judge-gym/engine-settings/provider";

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

export const BundleStrategySchema = z.enum([
  "window_round_robin",
  "random_bundle",
  "semantic_cluster",
  "semantic_cluster_projected",
]);

export type BundleStrategy = z.infer<typeof BundleStrategySchema>;

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
  evidence_bundle_size: z.number().int().min(1),
  bundle_strategy: BundleStrategySchema.optional(),
  bundle_strategy_version: z.string().optional(),
  clustering_seed: z.number().int().optional(),
});
