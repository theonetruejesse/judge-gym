import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getRunCompletedCount } from "./run_progress";

type ExperimentProgressCtx = QueryCtx | MutationCtx;

export async function getExperimentTotalCount(
  ctx: ExperimentProgressCtx,
  experimentId: Id<"experiments">,
): Promise<number> {
  const runs = await ctx.db
    .query("runs")
    .withIndex("by_experiment", (q) => q.eq("experiment_id", experimentId))
    .collect();

  let totalCount = 0;
  for (const run of runs) {
    totalCount += typeof run.completed_count === "number"
      ? run.completed_count
      : await getRunCompletedCount(ctx, run._id);
  }

  return totalCount;
}

export async function syncExperimentTotalCount(
  ctx: MutationCtx,
  experimentId: Id<"experiments">,
) {
  const experiment = await ctx.db.get(experimentId);
  if (!experiment) return;

  const totalCount = await getExperimentTotalCount(ctx, experimentId);
  await ctx.db.patch(experimentId, {
    total_count: totalCount,
  });
}
