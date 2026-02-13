import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import {
  LlmStageSchema,
  RunPolicySchema,
  DEFAULT_RUN_POLICY,
} from "../../models/core";

const DEFAULT_RUN_STAGES = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
] as const;

export const createRun = zMutation({
  args: z.object({
    experiment_tag: z.string(),
    stop_at_stage: LlmStageSchema.optional(),
    stages: z.array(LlmStageSchema).optional(),
    policy: RunPolicySchema.optional(),
  }),
  returns: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { experiment_tag, stop_at_stage, stages, policy }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);

    const now = Date.now();
    const run_id = await ctx.db.insert("runs", {
      experiment_id: experiment._id,
      status: "running",
      desired_state: "running",
      stop_at_stage,
      current_stage: undefined,
      last_stage_completed_at: undefined,
      policy: policy ?? DEFAULT_RUN_POLICY,
      created_at: now,
      updated_at: now,
    });

    const runStages = (stages ?? DEFAULT_RUN_STAGES).map((stage) => ({
      run_id,
      stage,
      status: "pending" as const,
      total_requests: 0,
      completed_requests: 0,
      failed_requests: 0,
      last_batch_id: undefined,
      updated_at: now,
    }));

    for (const row of runStages) {
      await ctx.db.insert("run_stages", row);
    }

    return { run_id };
  },
});

export const updateRunState = zMutation({
  args: z.object({
    run_id: zid("runs"),
    desired_state: z.enum(["running", "paused", "canceled"]),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, { run_id, desired_state }) => {
    await ctx.db.patch(run_id, {
      desired_state,
      updated_at: Date.now(),
    });
    return { ok: true };
  },
});

export const markStageProgress = zMutation({
  args: z.object({
    run_stage_id: zid("run_stages"),
    status: z.enum(["pending", "running", "complete", "failed"]),
    total_requests: z.number().optional(),
    completed_requests: z.number().optional(),
    failed_requests: z.number().optional(),
    last_batch_id: zid("llm_batches").optional(),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, { run_stage_id, ...fields }) => {
    await ctx.db.patch(run_stage_id, {
      ...fields,
      updated_at: Date.now(),
    });
    return { ok: true };
  },
});

export const setRunCurrentStage = zMutation({
  args: z.object({
    run_id: zid("runs"),
    current_stage: LlmStageSchema.optional(),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, { run_id, current_stage }) => {
    await ctx.db.patch(run_id, {
      current_stage,
      updated_at: Date.now(),
    });
    return { ok: true };
  },
});
