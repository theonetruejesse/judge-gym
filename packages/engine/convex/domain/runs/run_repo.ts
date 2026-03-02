import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { RunsTableSchema } from "../../models/experiments";
import type { Doc } from "../../_generated/dataModel";

const CreateRunArgsSchema = RunsTableSchema.pick({
  experiment_id: true,
  target_count: true,
});

export const createRun = zInternalMutation({
  args: CreateRunArgsSchema,
  returns: zid("runs"),
  handler: async (ctx, args) => {
    const { experiment_id, target_count } = args;
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const run_id = await ctx.db.insert("runs", {
      experiment_id,
      target_count,
      status: "start",
      current_stage: "rubric_gen",
    });

    for (let i = 0; i < args.target_count; i++) {
      const seed = i + 1; // todo, alter with a real random seed generator
      await ctx.db.insert("samples", {
        run_id,
        experiment_id: experiment._id,
        model: experiment.scoring_config.model,
        seed,
        rubric_id: null,
        rubric_critic_id: null,
        score_id: null,
        score_critic_id: null,
      });
    }

    return run_id;
  },
});

export const getRun = zInternalQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, args): Promise<Doc<"runs">> => {
    const run = await ctx.db.get(args.run_id);
    if (!run) throw new Error("Run not found");
    return run;
  },
});
