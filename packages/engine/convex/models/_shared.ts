import z from "zod";

// todo, update once batching/workflow is stable
export const modelTypeSchema = z.union([
    z.literal("gpt-4.1"),
    z.literal("gpt-4.1-mini"),
    z.literal("gpt-5.2"),
    z.literal("gpt-5.2-chat"), // not batchable
]);

export type ModelType = z.infer<typeof modelTypeSchema>;

export const providerTypeSchema = z.union([
    z.literal("openai"),
]);

export type ProviderType = z.infer<typeof providerTypeSchema>;

export const StateStatusSchema = z.enum([
    "start",
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
    randomizations: z.array(z.enum(["anonymize_stages", "hide_label_text", "shuffle_rubric_order"])),
});