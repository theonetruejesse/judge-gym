import z from "zod";
import { zQuery } from "./utils";

// --- Read queries for analysis consumption ---
// These are consumed by the Python analysis package via Convex HTTP API.

export const getExperimentSummary = zQuery({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_id", (q) => q.eq("experimentId", experimentId))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();

    const probes = await ctx.db.query("probes").collect();
    const sampleIds = new Set(samples.map((s) => s._id));
    const experimentProbes = probes.filter((p) => sampleIds.has(p.sampleId));

    return {
      experimentId: experiment.experimentId,
      modelId: experiment.modelId,
      concept: experiment.concept,
      taskType: experiment.taskType,
      status: experiment.status,
      config: experiment.config,
      counts: {
        samples: samples.length,
        abstained: samples.filter((s) => s.abstained).length,
        probes: experimentProbes.length,
      },
    };
  },
});

export const listExperimentSamples = zQuery({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    return ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();
  },
});

export const listExperimentRubrics = zQuery({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    const rubrics = await ctx.db.query("rubrics").collect();
    return rubrics.filter((r) => r.experimentId === experimentId);
  },
});

export const listExperimentProbes = zQuery({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();
    const sampleIds = new Set(samples.map((s) => s._id));

    const probes = await ctx.db.query("probes").collect();
    return probes.filter((p) => sampleIds.has(p.sampleId));
  },
});

export const listExperimentsByTaskType = zQuery({
  args: z.object({ taskType: z.string() }),
  handler: async (ctx, { taskType }) => {
    return ctx.db
      .query("experiments")
      .withIndex("by_task_type", (q) => q.eq("taskType", taskType as "ecc" | "control" | "benchmark"))
      .collect();
  },
});

export const exportExperimentCSV = zQuery({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_id", (q) => q.eq("experimentId", experimentId))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();

    // Flat denormalized rows for pandas
    return samples.map((s) => ({
      experimentId: s.experimentId,
      modelId: s.modelId,
      concept: experiment.concept,
      taskType: experiment.taskType,
      scoringMethod: experiment.config.scoringMethod,
      scaleSize: experiment.config.scaleSize,
      randomizeLabels: experiment.config.randomizeLabels,
      neutralizeEvidence: experiment.config.neutralizeEvidence,
      promptOrdering: experiment.config.promptOrdering,
      isSwap: s.isSwap,
      abstained: s.abstained,
      rawVerdict: s.rawVerdict,
      decodedScores: s.decodedScores,
      displaySeed: s.displaySeed,
    }));
  },
});
