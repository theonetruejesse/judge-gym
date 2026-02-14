import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../platform/utils";
import { LlmStageSchema } from "../../../models/core";

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

export const refreshRunStageCountsForExperiment = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    stage: LlmStageSchema,
  }),
  handler: async (ctx, { experiment_id, stage }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment?.active_run_id) return;
    const activeRun = await ctx.db.get(experiment.active_run_id);
    if (!activeRun) return;
    if (activeRun.status === "complete" || activeRun.status === "canceled") {
      return;
    }

    const stageRow = await ctx.db
      .query("run_stages")
      .withIndex("by_run", (q) => q.eq("run_id", activeRun._id))
      .filter((q) => q.eq(q.field("stage"), stage))
      .first();

    if (!stageRow) return;

    let total = 0;
    let completed = 0;
    let failed = 0;

    for (const status of REQUEST_STATUSES) {
      const rows = await ctx.db
        .query("llm_requests")
        .withIndex("by_stage_status", (q) =>
          q.eq("stage", stage).eq("status", status),
        )
        .collect();
      const filtered = rows.filter((r) => r.experiment_id === experiment_id);
      total += filtered.length;
      if (status === "completed") completed += filtered.length;
      if (status === "error") failed += filtered.length;
    }

    const stageStatus = computeStageStatus({ total, completed, failed });

    await ctx.db.patch(stageRow._id, {
      status: stageStatus,
      total_requests: total,
      completed_requests: completed,
      failed_requests: failed,
      updated_at: Date.now(),
    });

    const stages = await ctx.db
      .query("run_stages")
      .withIndex("by_run", (q) => q.eq("run_id", activeRun._id))
      .collect();

    const allComplete = stages.every((s) => s.status === "complete");
    if (allComplete) {
      await ctx.db.patch(activeRun._id, {
        status: "complete",
        updated_at: Date.now(),
      });
      await ctx.db.patch(experiment._id, {
        active_run_id: undefined,
        status: "complete",
      });
    }
  },
});
