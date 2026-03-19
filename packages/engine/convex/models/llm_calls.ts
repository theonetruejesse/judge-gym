import { zid } from "convex-helpers/server/zod4";
import z from "zod";
import { modelTypeSchema, providerTypeSchema } from "../platform/providers/provider_types";

export const ProcessStatusSchema = z.enum([
  "queued",
  "submitting",
  "running",
  "finalizing",
  "success",
  "error",
]);

export const LlmBatchesTableSchema = z.object({
  provider: providerTypeSchema,
  model: modelTypeSchema,
  status: ProcessStatusSchema,
  attempt_index: z.number().int().positive(),
  batch_ref: z.string().optional(),
  input_file_id: z.string().optional(),
  submission_id: z.string().optional(),
  submitting_at: z.number().optional(),
  next_poll_at: z.number().optional(),
  last_error: z.string().optional(),
  poll_claim_owner: z.string().nullable().optional(),
  poll_claim_expires_at: z.number().nullable().optional(),
  // for decoding windows/runs
  custom_key: z.string(),
});

export const LlmJobsTableSchema = z.object({
  provider: providerTypeSchema,
  model: modelTypeSchema,
  status: ProcessStatusSchema,
  attempt_index: z.number().int().positive(),
  // for decoding windows/runs
  custom_key: z.string(),
  next_run_at: z.number().optional(),
  last_error: z.string().optional(),
  run_claim_owner: z.string().nullable().optional(),
  run_claim_expires_at: z.number().nullable().optional(),
});

export const RequestStatusSchema = z.enum([
  "pending",
  "success",
  "error",
]);

export const LlmPromptTemplatesTableSchema = z.object({
  content_hash: z.string(),
  content: z.string(),
});

export const LlmRequestsTableSchema = z.object({
  status: RequestStatusSchema,
  run_id: zid("runs").nullable().optional(),
  job_id: zid("llm_jobs").nullable().optional(),
  batch_id: zid("llm_batches").nullable().optional(),
  model: modelTypeSchema,
  user_prompt: z.string(),
  system_prompt_id: zid("llm_prompt_templates").nullable().optional(),
  assistant_output: z.string().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  // for decoding runs/experiments
  custom_key: z.string(),
  attempt_index: z.number().int().positive().optional(),
  next_attempt_at: z.number().optional(),
  last_error: z.string().optional(),
});

export const RequestTargetResolutionSchema = z.enum([
  "pending",
  "retryable",
  "exhausted",
  "succeeded",
]);

export const ProcessRequestTargetStateTableSchema = z.object({
  process_type: z.enum(["run", "window"]),
  process_id: z.string(),
  target_type: z.enum(["sample", "sample_score_target", "evidence"]),
  target_id: z.string(),
  stage: z.string(),
  custom_key: z.string(),
  resolution: RequestTargetResolutionSchema,
  active_request_id: zid("llm_requests").nullable(),
  latest_request_id: zid("llm_requests").nullable(),
  success_request_id: zid("llm_requests").nullable(),
  latest_error_request_id: zid("llm_requests").nullable(),
  attempt_count: z.number().int().min(0),
  retry_count: z.number().int().min(0),
  historical_error_count: z.number().int().min(0),
  oldest_pending_ts: z.number().nullable(),
  latest_error_class: z.string().nullable(),
  latest_error_message: z.string().nullable(),
  updated_at_ms: z.number(),
});
