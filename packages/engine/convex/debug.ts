import z from "zod";
import { zInternalMutation, zMutation } from "./utils";


// todo, move this to a danger file
/**
 * Dev utilities — use from dashboard or MCP during development.
 */

export const nukeTables = zInternalMutation({
  args: z.object({
    confirm: z.literal("yes-delete-everything"),
  }),
  handler: async (ctx, { confirm }) => {
    if (confirm !== "yes-delete-everything") return;

    const tables = [
      "experiments",
      "windows",
      "evidence",
      "rubrics",
      "samples",
      "scores",
      "probes",
      "usage",
    ] as const;

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }
  },
});

export const cleanupExperiment = zMutation({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();

    if (!experiment) return;

    // Delete scores + probes
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();

    for (const score of scores) {
      const probes = await ctx.db
        .query("probes")
        .withIndex("by_score", (q) => q.eq("scoreId", score._id))
        .collect();
      for (const probe of probes) {
        await ctx.db.delete(probe._id);
      }
      await ctx.db.delete(score._id);
    }

    // Delete samples
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();

    for (const sample of samples) {
      await ctx.db.delete(sample._id);
    }

    // Delete rubrics
    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experimentId", experiment._id),
      )
      .collect();
    for (const rubric of rubrics) {
      await ctx.db.delete(rubric._id);
    }

    // Delete experiment
    await ctx.db.delete(experiment._id);
  },
});
