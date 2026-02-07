import z from "zod";
import { zQuery } from "./utils";

// --- Read queries for analysis consumption ---
// These are consumed by the Python analysis package via Convex HTTP API.

export const getExperimentSummary = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentTag", experimentTag))
      .collect();

    const probes = await ctx.db.query("probes").collect();
    const sampleIds = new Set(samples.map((s) => s._id));
    const experimentProbes = probes.filter((p) => sampleIds.has(p.sampleId));

    return {
      experimentTag: experiment.experimentTag,
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
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    return ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentTag", experimentTag))
      .collect();
  },
});

export const listExperimentRubrics = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const rubrics = await ctx.db.query("rubrics").collect();
    return rubrics.filter((r) => r.experimentTag === experimentTag);
  },
});

export const listExperimentProbes = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentTag", experimentTag))
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
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentTag", experimentTag))
      .collect();

    // Flat denormalized rows for pandas
    return samples.map((s) => ({
      experimentTag: s.experimentTag,
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
