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
  batch_ref: z.string(),
  // for decoding windows/runs
  custom_id: z.string(),
});

export const LlmWorkflowsTableSchema = z.object({
  provider: providerTypeSchema,
  model: modelTypeSchema,
  status: ProcessStatusSchema,
  workflow_ref: z.string(),
  // for decoding windows/runs
  custom_id: z.string(),
});

export const RequestStatusSchema = z.enum([
  "pending",
  "success",
  "error",
]);

export const LlmRequestsTableSchema = z.object({
  status: RequestStatusSchema,
  workflow_id: zid("llm_workflows").optional(),
  batch_id: zid("llm_batches").optional(),
  model: modelTypeSchema,
  temperature: z.number(),
  user_prompt: z.string().optional(),
  system_prompt: z.string().optional(),
  assistant_reasoning: z.string().optional(),
  assistant_output: z.string().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  // for decoding runs/experiments
  custom_id: z.string(),
});