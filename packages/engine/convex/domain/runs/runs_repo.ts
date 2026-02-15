import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../platform/utils";
import {
  LlmStageSchema,
  RunDesiredStateSchema,
  RunStageStatusSchema,
  RunStatusSchema,
} from "../../models/core";
import { RunsTableSchema, RunStagesTableSchema } from "../../models/runs";

export const createRun = zInternalMutation({
  args: RunsTableSchema,
  handler: async (ctx, args) => ctx.db.insert("runs", args),
});

export const getRun = zInternalQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("Run not found");
    return run;
  },
});

export const patchRun = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    status: RunStatusSchema.optional(),
    desired_state: RunDesiredStateSchema.optional(),
    stop_at_stage: LlmStageSchema.optional(),
    current_stage: LlmStageSchema.optional(),
    last_stage_completed_at: z.number().optional(),
    updated_at: z.number().optional(),
  }),
  handler: async (ctx, { run_id, ...fields }) => {
    await ctx.db.patch(run_id, fields);
  },
});

export const createRunStage = zInternalMutation({
  args: RunStagesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("run_stages", args),
});

export const patchRunStage = zInternalMutation({
  args: z.object({
    run_stage_id: zid("run_stages"),
    status: RunStageStatusSchema.optional(),
    total_requests: z.number().optional(),
    completed_requests: z.number().optional(),
    failed_requests: z.number().optional(),
    last_batch_id: zid("llm_batches").optional(),
    updated_at: z.number().optional(),
  }),
  handler: async (ctx, { run_stage_id, ...fields }) => {
    await ctx.db.patch(run_stage_id, fields);
  },
});
