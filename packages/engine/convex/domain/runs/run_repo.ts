import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { RunsTableSchema } from "../../models/experiments";
import {
  RubricCriticsTableSchema,
  RubricsTableSchema,
  SamplesTableSchema,
  ScoreCriticsTableSchema,
  ScoresTableSchema,
} from "../../models/samples";
import type { Doc } from "../../_generated/dataModel";

const CreateRunArgsSchema = RunsTableSchema.pick({
  experiment_id: true,
  target_count: true,
});

export const createRun = zInternalMutation({
  args: CreateRunArgsSchema,
  returns: zid("runs"),
  handler: async (ctx, args) => {
    return ctx.db.insert("runs", {
      experiment_id: args.experiment_id,
      target_count: args.target_count,
      status: "start",
      current_stage: "rubric_gen",
    });
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

const CreateSampleArgsSchema = SamplesTableSchema.pick({
  run_id: true,
  experiment_id: true,
  model: true,
  seed: true,
});

export const createSample = zInternalMutation({
  args: CreateSampleArgsSchema,
  returns: zid("samples"),
  handler: async (ctx, args) => {
    return ctx.db.insert("samples", {
      run_id: args.run_id,
      experiment_id: args.experiment_id,
      model: args.model,
      seed: args.seed,
      rubric_id: null,
      rubric_critic_id: null,
      score_id: null,
      score_critic_id: null,
    });
  },
});

export const listSamplesByRun = zInternalQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, args): Promise<Doc<"samples">[]> => {
    return ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .collect();
  },
});

export const patchSample = zInternalMutation({
  args: z.object({
    sample_id: zid("samples"),
    patch: SamplesTableSchema.partial(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sample_id, args.patch);
  },
});

export const createRubric = zInternalMutation({
  args: RubricsTableSchema,
  returns: zid("rubrics"),
  handler: async (ctx, args) => {
    return ctx.db.insert("rubrics", args);
  },
});

export const createRubricCritic = zInternalMutation({
  args: RubricCriticsTableSchema,
  returns: zid("rubric_critics"),
  handler: async (ctx, args) => {
    return ctx.db.insert("rubric_critics", args);
  },
});

export const createScore = zInternalMutation({
  args: ScoresTableSchema,
  returns: zid("scores"),
  handler: async (ctx, args) => {
    return ctx.db.insert("scores", args);
  },
});

export const createScoreCritic = zInternalMutation({
  args: ScoreCriticsTableSchema,
  returns: zid("score_critics"),
  handler: async (ctx, args) => {
    return ctx.db.insert("score_critics", args);
  },
});
