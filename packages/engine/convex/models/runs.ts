import { zid, zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineTable } from "convex/server";
import z from "zod";
import {
  LlmStageSchema,
  RunDesiredStateSchema,
  RunStageStatusSchema,
  RunStatusSchema,
  RunPolicySchema,
} from "./core";

export const RunsTableSchema = z.object({
  experiment_id: zid("experiments"),
  run_config_id: zid("run_configs"),
  policy_snapshot: RunPolicySchema,
  status: RunStatusSchema,
  desired_state: RunDesiredStateSchema,
  stop_at_stage: LlmStageSchema.optional(),
  current_stage: LlmStageSchema.optional(),
  last_stage_completed_at: z.number().optional(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const RunStagesTableSchema = z.object({
  run_id: zid("runs"),
  stage: LlmStageSchema,
  status: RunStageStatusSchema,
  total_requests: z.number(),
  completed_requests: z.number(),
  failed_requests: z.number(),
  last_batch_id: zid("llm_batches").optional(),
  updated_at: z.number(),
});

export const Runs = defineTable(zodOutputToConvex(RunsTableSchema));
export const RunStages = defineTable(zodOutputToConvex(RunStagesTableSchema));
