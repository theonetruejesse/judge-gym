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

// --- Ground truth ---
export const GroundTruthSchema = z.object({
  source: z.string(),
  value: z.number().optional(),
  label: z.string().optional(),
});

// --- Experiment config (design space axes) ---
export const ExperimentConfigSchema = z.object({
  scale_size: z.number(),
  randomizations: z.array(
    z.enum(["anon-label", "rubric-order-shuffle", "hide-label-name"]),
  ),
  evidence_view: z.enum(["raw", "cleaned", "neutralized", "abstracted"]),
  scoring_method: z.union([
    z.literal("freeform-suffix-single"),
    z.literal("freeform-suffix-subset"),
  ]),
  prompt_ordering: z.union([
    z.literal("rubric-first"),
    z.literal("evidence-first"),
  ]),
  abstain_enabled: z.boolean(),
});

export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

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

// --- Run policy (lab scheduling + batching knobs) ---
export const RunPolicySchema = z.object({
  poll_interval_ms: z.number().int().min(500),
  max_batch_size: z.number().int().min(1),
  max_new_batches_per_tick: z.number().int().min(1),
  max_poll_per_tick: z.number().int().min(1),
  max_batch_retries: z.number().int().min(0),
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

export const DEFAULT_RUN_POLICY: RunPolicy = {
  poll_interval_ms: 5_000,
  max_batch_size: 500,
  max_new_batches_per_tick: 4,
  max_poll_per_tick: 10,
  max_batch_retries: 2,
  retry_backoff_ms: 60_000,
  provider_models: [
    {
      provider: "openai",
      models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2", "gpt-5.2-chat"],
    },
    {
      provider: "anthropic",
      models: ["claude-sonnet-4.5", "claude-haiku-4.5"],
    },
    // {
    //   provider: "google",
    //   models: ["gemini-3.0-flash"],
    // }, // TODO: Re-enable when Vertex integration is ready.
  ],
};

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
