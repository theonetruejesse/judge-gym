import z from "zod";

export const LlmBatchExecutionStatusSchema = z.enum([
  "preparing",
  "submitted",
  "completed",
  "failed",
  "cancelled",
]);

export const LlmBatchExecutionsTableSchema = z.object({
  batch_key: z.string(),
  process_kind: z.enum(["window", "run"]),
  process_id: z.string(),
  stage: z.string(),
  provider: z.string(),
  model: z.string(),
  workflow_id: z.string(),
  item_count: z.number(),
  provider_batch_id: z.string().nullable(),
  input_file_id: z.string().nullable().optional(),
  output_file_id: z.string().nullable().optional(),
  error_file_id: z.string().nullable().optional(),
  status: LlmBatchExecutionStatusSchema,
  last_known_provider_status: z.string().nullable().optional(),
  last_error_message: z.string().nullable().optional(),
  submitted_at_ms: z.number().nullable().optional(),
  completed_at_ms: z.number().nullable().optional(),
});
