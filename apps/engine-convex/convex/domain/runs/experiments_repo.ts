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

export const upsertExperimentByTag = zInternalMutation({
  args: CreateExperimentArgsSchema.extend({
    experiment_tag: ExperimentsTableSchema.shape.experiment_tag,
    force_reconfigure: z.boolean().default(false),
  }),
  returns: z.object({
    experiment_id: zid("experiments"),
    action: z.enum(["created", "updated", "unchanged", "conflict"]),
  }),
  handler: async (ctx, args) => {
    if (args.bundle_plan_id) {
      const bundlePlan = await ctx.db.get(args.bundle_plan_id);
      if (!bundlePlan) throw new Error("Bundle plan not found");
      if (bundlePlan.pool_id !== args.pool_id) {
        throw new Error("Bundle plan pool does not match experiment pool");
      }
    }

    const existing = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experiment_tag", args.experiment_tag))
      .first();
    if (!existing) {
      const experiment_id = await ctx.db.insert("experiments", {
        experiment_tag: args.experiment_tag,
        pool_id: args.pool_id,
        bundle_plan_id: args.bundle_plan_id,
        rubric_config: args.rubric_config,
        scoring_config: args.scoring_config,
        total_count: 0,
      });
      return {
        experiment_id,
        action: "created" as const,
      };
    }

    const unchanged = existing.pool_id === args.pool_id
      && existing.bundle_plan_id === args.bundle_plan_id
      && JSON.stringify(existing.rubric_config) === JSON.stringify(args.rubric_config)
      && JSON.stringify(existing.scoring_config) === JSON.stringify(args.scoring_config);
    if (unchanged) {
      return {
        experiment_id: existing._id,
        action: "unchanged" as const,
      };
    }

    if (!args.force_reconfigure && existing.total_count > 0) {
      return {
        experiment_id: existing._id,
        action: "conflict" as const,
      };
    }

    await ctx.db.patch(existing._id, {
      pool_id: args.pool_id,
      bundle_plan_id: args.bundle_plan_id,
      rubric_config: args.rubric_config,
      scoring_config: args.scoring_config,
    });
    return {
      experiment_id: existing._id,
      action: "updated" as const,
    };
  },
});
