import z from "zod";
import { zInternalMutation, zMutation } from "./utils";

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
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    // Delete samples
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();

    for (const sample of samples) {
      // Delete probes for this sample
      const probes = await ctx.db
        .query("probes")
        .withIndex("by_sample", (q) => q.eq("sampleId", sample._id))
        .collect();
      for (const probe of probes) {
        await ctx.db.delete(probe._id);
      }
      await ctx.db.delete(sample._id);
    }

    // Delete rubrics
    const rubrics = await ctx.db.query("rubrics").collect();
    for (const rubric of rubrics) {
      if (rubric.experimentId === experimentId) {
        await ctx.db.delete(rubric._id);
      }
    }

    // Delete experiment
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_id", (q) => q.eq("experimentId", experimentId))
      .unique();
    if (experiment) {
      await ctx.db.delete(experiment._id);
    }
  },
});
