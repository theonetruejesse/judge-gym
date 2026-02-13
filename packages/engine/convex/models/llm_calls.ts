import { zid, zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import z from "zod";
import {
  LlmBatchItemStatusSchema,
  LlmBatchStatusSchema,
  LlmRequestStatusSchema,
  LlmStageSchema,
  modelTypeSchema,
  providerSchema,
} from "./core";

export const LlmRequestsTableSchema = z.object({
  stage: LlmStageSchema,
  provider: providerSchema,
  model: modelTypeSchema,
  system_prompt: z.string().optional(),
  user_prompt: z.string().optional(),
  experiment_id: zid("experiments").nullable(),
  rubric_id: zid("rubrics").nullable(),
  sample_id: zid("samples").nullable(),
  evidence_id: zid("evidences").nullable(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  seed: z.number().optional(),
  max_tokens: z.number().optional(),
  stop: z.array(z.string()).optional(),
  status: LlmRequestStatusSchema,
  attempt: z.number(),
  request_version: z.number(),
  last_error: z.string().optional(),
  parse_error: z.string().optional(),
  result_message_id: zid("llm_messages").optional(),
  batch_item_id: zid("llm_batch_items").optional(),
  next_retry_at: z.number().optional(),
});

export const LlmMessagesTableSchema = z.object({
  system_prompt: z.string().optional(),
  user_prompt: z.string(),
  assistant_output: z.string().optional(),
  assistant_reasoning: z.string().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
  cached_input_tokens: z.number().optional(),
  reasoning_tokens: z.number().optional(),
  provider: providerSchema,
  model: modelTypeSchema,
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  seed: z.number().optional(),
  max_tokens: z.number().optional(),
  stop: z.array(z.string()).optional(),
});

export const LlmBatchesTableSchema = z.object({
  run_id: zid("runs").optional(),
  provider: providerSchema,
  model: modelTypeSchema,
  batch_ref: z.string().optional(),
  status: LlmBatchStatusSchema,
  completion_window: z.string().optional(),
  created_at: z.number(),
  locked_until: z.number().optional(),
  next_poll_at: z.number().optional(),
});

export const LlmBatchItemsTableSchema = z.object({
  batch_id: zid("llm_batches"),
  request_id: zid("llm_requests"),
  custom_id: z.string(),
  status: LlmBatchItemStatusSchema,
  attempt: z.number(),
  last_error: z.string().optional(),
});

export const LlmRequests = defineTable(zodOutputToConvex(LlmRequestsTableSchema));
export const LlmMessages = defineTable(zodOutputToConvex(LlmMessagesTableSchema));
export const LlmBatches = defineTable(zodOutputToConvex(LlmBatchesTableSchema));
export const LlmBatchItems = defineTable(zodOutputToConvex(LlmBatchItemsTableSchema));
