import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { ExperimentsTableSchema } from "../../models/experiments";
import { buildRandomTag } from "../../utils/tags";

export const CreateExperimentArgsSchema = ExperimentsTableSchema.pick({
  experiment_tag: true,
  pool_id: true,
  bundle_plan_id: true,
  rubric_config: true,
  scoring_config: true,
}).extend({
  experiment_tag: ExperimentsTableSchema.shape.experiment_tag.optional(),
});

export const createExperiment = zInternalMutation({
  args: CreateExperimentArgsSchema,
  returns: zid("experiments"),
  handler: async (ctx, args) => {
    if (args.bundle_plan_id) {
      const bundlePlan = await ctx.db.get(args.bundle_plan_id);
      if (!bundlePlan) throw new Error("Bundle plan not found");
      if (bundlePlan.pool_id !== args.pool_id) {
        throw new Error("Bundle plan pool does not match experiment pool");
      }
    }
    return ctx.db.insert("experiments", {
      experiment_tag: args.experiment_tag ?? buildRandomTag(),
      pool_id: args.pool_id,
      bundle_plan_id: args.bundle_plan_id,
      rubric_config: args.rubric_config,
      scoring_config: args.scoring_config,
      total_count: 0,
    });
  },
});
