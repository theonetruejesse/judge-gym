import z from "zod";

// --- Model types ---
export const modelTypeSchema = z.union([
  z.literal("gpt-4.1"),
  z.literal("gpt-4.1-mini"),
  z.literal("gpt-5.2"),
  z.literal("gpt-5.2-chat"),
  z.literal("claude-sonnet-4.5"),
  z.literal("claude-haiku-4.5"),
  // z.literal("gemini-3.0-flash"), // TODO: Re-enable when Vertex integration is ready.
]);

export type ModelType = z.infer<typeof modelTypeSchema>;

export const providerSchema = z.union([
  z.literal("openai"),
  z.literal("anthropic"),
  // z.literal("google"), // TODO: Re-enable when Vertex integration is ready.
]);

export type Provider = z.infer<typeof providerSchema>;

// --- Task types ---
export const TaskTypeSchema = z.union([
  z.literal("ecc"),
  z.literal("control"),
  z.literal("benchmark"),
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

// --- Evidence view ---
export const EvidenceViewSchema = z.enum([
  "l0_raw",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
]);

export const EvidenceViewInputSchema = z.union([
  EvidenceViewSchema,
  z.literal("raw"),
  z.literal("cleaned"),
  z.literal("neutralized"),
  z.literal("abstracted"),
]);

export type EvidenceView = z.infer<typeof EvidenceViewSchema>;
export type EvidenceViewInput = z.infer<typeof EvidenceViewInputSchema>;

export function normalizeEvidenceView(
  value: EvidenceViewInput,
): EvidenceView {
  switch (value) {
    case "raw":
      return "l0_raw";
    case "cleaned":
      return "l1_cleaned";
    case "neutralized":
      return "l2_neutralized";
    case "abstracted":
      return "l3_abstracted";
    default:
      return value;
  }
}

// --- Experiment config (design space axes) ---
export const RubricStageConfigSchema = z.object({
  scale_size: z.number(),
  model_id: modelTypeSchema,
});

export const ScoringStageConfigSchema = z.object({
  model_id: modelTypeSchema,
  method: z.union([z.literal("single"), z.literal("subset")]),
  randomizations: z.array(
    z.enum(["anonymize_labels", "shuffle_rubric_order", "hide_label_text"]),
  ),
  evidence_view: EvidenceViewSchema,
  abstain_enabled: z.boolean(),
});

export const RunCountsSchema = z.object({
  sample_count: z.number().int().min(1),
  evidence_cap: z.number().int().min(1),
});

export const ExperimentConfigSchema = z.object({
  rubric_stage: RubricStageConfigSchema,
  scoring_stage: ScoringStageConfigSchema,
});

export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

export const ExperimentConfigInputSchema = ExperimentConfigSchema.extend({
  scoring_stage: ScoringStageConfigSchema.extend({
    evidence_view: EvidenceViewInputSchema,
  }),
});

export type ExperimentConfigInput = z.infer<typeof ExperimentConfigInputSchema>;

// --- Experiment status ---
export const ExperimentStatusSchema = z.union([
  z.literal("pending"),
  z.literal("running"),
  z.literal("paused"),
  z.literal("complete"),
  z.literal("canceled"),
]);

export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;

export const ParseStatusSchema = z.union([
  z.literal("pending"),
  z.literal("parsed"),
  z.literal("failed"),
]);

export type ParseStatus = z.infer<typeof ParseStatusSchema>;

export const RunStatusSchema = z.union([
  z.literal("pending"),
  z.literal("running"),
  z.literal("paused"),
  z.literal("complete"),
  z.literal("canceled"),
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunDesiredStateSchema = z.union([
  z.literal("running"),
  z.literal("paused"),
  z.literal("canceled"),
]);

export type RunDesiredState = z.infer<typeof RunDesiredStateSchema>;

// --- Run policy (scheduling + batching knobs) ---
export const RunPolicySchema = z.object({
  poll_interval_ms: z.number().int().min(500),
  max_batch_size: z.number().int().min(1),
  max_new_batches_per_tick: z.number().int().min(1),
  max_poll_per_tick: z.number().int().min(1),
  max_concurrent_batches: z.number().int().min(1).optional(),
  max_concurrent_requests: z.number().int().min(1).optional(),
  max_tokens: z.number().int().min(1).optional(),
  max_batch_retries: z.number().int().min(0),
  max_request_attempts: z.number().int().min(1),
  retry_backoff_ms: z.number().int().min(0),
  provider_models: z
    .array(
      z.object({
        provider: providerSchema,
        models: z.array(modelTypeSchema).min(1),
      }),
    )
    .min(1),
});

export type RunPolicy = z.infer<typeof RunPolicySchema>;


export const LlmStageSchema = z.union([
  z.literal("evidence_clean"),
  z.literal("evidence_neutralize"),
  z.literal("evidence_abstract"),
  z.literal("rubric_gen"),
  z.literal("rubric_critic"),
  z.literal("score_gen"),
  z.literal("score_critic"),
]);

export type LlmStage = z.infer<typeof LlmStageSchema>;

export const RunStageStatusSchema = z.union([
  z.literal("pending"),
  z.literal("running"),
  z.literal("complete"),
  z.literal("failed"),
]);

export type RunStageStatus = z.infer<typeof RunStageStatusSchema>;

export const LlmRequestStatusSchema = z.union([
  z.literal("queued"),
  z.literal("submitted"),
  z.literal("completed"),
  z.literal("error"),
  z.literal("canceled"),
]);

export type LlmRequestStatus = z.infer<typeof LlmRequestStatusSchema>;

export const LlmBatchStatusSchema = z.union([
  z.literal("queued"),
  z.literal("submitted"),
  z.literal("running"),
  z.literal("completed"),
  z.literal("error"),
  z.literal("canceled"),
]);

export type LlmBatchStatus = z.infer<typeof LlmBatchStatusSchema>;

export const LlmBatchItemStatusSchema = z.union([
  z.literal("queued"),
  z.literal("submitted"),
  z.literal("completed"),
  z.literal("error"),
  z.literal("canceled"),
]);

export type LlmBatchItemStatus = z.infer<typeof LlmBatchItemStatusSchema>;
