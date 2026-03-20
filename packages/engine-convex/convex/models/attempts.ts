import { zid } from "convex-helpers/server/zod4";
import z from "zod";
import {
  modelTypeSchema,
  providerTypeSchema,
} from "../platform/providers/provider_types";

export const LlmAttemptStatusSchema = z.enum([
  "started",
  "succeeded",
  "failed",
]);

export const LlmAttemptPayloadKindSchema = z.enum([
  "user_prompt",
  "assistant_output",
  "error",
]);

export const LlmPromptTemplatesTableSchema = z.object({
  content_hash: z.string(),
  content: z.string(),
});

export const LlmAttemptsTableSchema = z.object({
  process_kind: z.enum(["window", "run"]),
  process_id: z.string(),
  target_type: z.enum(["evidence", "sample", "sample_score_target"]),
  target_id: z.string(),
  stage: z.string(),
  provider: providerTypeSchema,
  model: modelTypeSchema,
  operation_type: z.enum(["chat", "batch", "search"]),
  workflow_id: z.string(),
  prompt_template_id: zid("llm_prompt_templates").nullable(),
  user_prompt_payload_id: zid("llm_attempt_payloads").nullable(),
  assistant_output_payload_id: zid("llm_attempt_payloads").nullable(),
  error_payload_id: zid("llm_attempt_payloads").nullable(),
  status: LlmAttemptStatusSchema,
  started_at_ms: z.number(),
  finished_at_ms: z.number().nullable(),
  input_tokens: z.number().nullable().optional(),
  output_tokens: z.number().nullable().optional(),
  total_tokens: z.number().nullable().optional(),
  metadata_json: z.string().nullable().optional(),
});

export const LlmAttemptPayloadsTableSchema = z.object({
  attempt_id: zid("llm_attempts"),
  kind: LlmAttemptPayloadKindSchema,
  content_text: z.string(),
  content_hash: z.string(),
  byte_size: z.number(),
  content_type: z.string(),
});
