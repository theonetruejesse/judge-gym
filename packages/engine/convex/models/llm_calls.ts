import { zid } from "convex-helpers/server/zod4";
import z from "zod";
import { modelTypeSchema, providerTypeSchema } from "./_shared";

export const ProcessStatusSchema = z.enum([
  "queued",
  "running",
  "success",
  "error",
]);

export const LlmBatchesTableSchema = z.object({
  provider: providerTypeSchema,
  model: modelTypeSchema,
  status: ProcessStatusSchema,
  batch_ref: z.string().optional(),
  attempts: z.number().int().min(0).optional(),
  next_poll_at: z.number().optional(),
  last_error: z.string().optional(),
  // for decoding windows/runs
  custom_key: z.string(),
});

export const LlmJobsTableSchema = z.object({
  provider: providerTypeSchema,
  model: modelTypeSchema,
  status: ProcessStatusSchema,
  // for decoding windows/runs
  custom_key: z.string(),
  next_run_at: z.number().optional(),
  last_error: z.string().optional(),
});

export const RequestStatusSchema = z.enum([
  "pending",
  "success",
  "error",
]);

export const LlmRequestsTableSchema = z.object({
  status: RequestStatusSchema,
  job_id: zid("llm_jobs").optional(),
  batch_id: zid("llm_batches").optional(),
  model: modelTypeSchema,
  user_prompt: z.string(),
  system_prompt: z.string().optional(),
  assistant_reasoning: z.string().optional(),
  assistant_output: z.string().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  // for decoding runs/experiments
  custom_key: z.string(),
  attempts: z.number().int().min(0).optional(),
  next_attempt_at: z.number().optional(),
  last_error: z.string().optional(),
});
