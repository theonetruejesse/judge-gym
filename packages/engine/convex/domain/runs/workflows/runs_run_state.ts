import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../platform/utils";
import { LlmStageSchema } from "../../../models/core";
import { internal } from "../../../_generated/api";

const REQUEST_STATUSES = [
  "queued",
  "submitted",
  "completed",
  "error",
  "canceled",
] as const;

export function computeStageStatus(args: {
  total: number;
  completed: number;
  failed: number;
}): "pending" | "running" | "complete" | "failed" {
  const { total, completed, failed } = args;
  if (total === 0) return "pending";
  if (completed + failed >= total) {
    return failed > 0 ? "failed" : "complete";
  }
  return "running";
}

export const refreshRunStageCountsForRun = zInternalMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: LlmStageSchema,
  }),
  handler: async (ctx, { run_id, stage }) => {
    const run = await ctx.db.get(run_id);
    if (!run) return;
    if (run.status === "complete" || run.status === "canceled") {
      return;
    }

    const stageRow = await ctx.db
      .query("run_stages")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .filter((q) => q.eq(q.field("stage"), stage))
      .first();

    if (!stageRow) return;

    let total = 0;
    let completed = 0;
    let failed = 0;

    for (const status of REQUEST_STATUSES) {
      const rows = await ctx.db
        .query("llm_requests")
        .withIndex("by_run_stage_status", (q) =>
          q.eq("run_id", run._id).eq("stage", stage).eq("status", status),
        )
        .collect();
      total += rows.length;
      if (status === "completed") completed += rows.length;
      if (status === "error") failed += rows.length;
    }

    const stageStatus = computeStageStatus({ total, completed, failed });

    await ctx.db.patch(stageRow._id, {
      status: stageStatus,
      total_requests: total,
      completed_requests: completed,
      failed_requests: failed,
      updated_at: Date.now(),
    });

    if (
      stage === "rubric_critic" &&
      stageStatus === "complete" &&
      !run.scoring_seeded_at &&
      run.desired_state === "running"
    ) {
      await ctx.runMutation(
        internal.domain.experiments.stages.scoring.workflows.experiments_scoring_seed_requests
          .seedScoreRequests,
        { experiment_id: run.experiment_id, run_id: run._id },
      );
      await ctx.db.patch(run._id, {
        scoring_seeded_at: Date.now(),
        current_stage: "score_gen",
        updated_at: Date.now(),
      });
    }

    if (
      run.desired_state === "paused" &&
      run.stop_at_stage === stage &&
      stageStatus === "complete"
    ) {
      await ctx.db.patch(run._id, {
        status: "paused",
        updated_at: Date.now(),
      });
    }

    const stages = await ctx.db
      .query("run_stages")
      .withIndex("by_run", (q) => q.eq("run_id", run._id))
      .collect();

    const allComplete = stages.every((s) => s.status === "complete");
    if (allComplete) {
      await ctx.db.patch(run._id, {
        status: "complete",
        last_stage_completed_at: Date.now(),
        updated_at: Date.now(),
      });
    }
  },
});
