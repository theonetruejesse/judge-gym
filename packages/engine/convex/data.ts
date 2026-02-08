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
    const window = await ctx.db.get(experiment.windowId);
    if (!window) throw new Error("Window not found");

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();

    const probes = await ctx.db.query("probes").collect();
    const scoreIds = new Set(scores.map((s) => s._id));
    const experimentProbes = probes.filter((p) => scoreIds.has(p.scoreId));

    return {
      experimentTag: experiment.experimentTag,
      windowId: experiment.windowId,
      modelId: experiment.modelId,
      concept: window.concept,
      taskType: experiment.taskType,
      status: experiment.status,
      config: experiment.config,
      counts: {
        samples: samples.length,
        scores: scores.length,
        abstained: scores.filter((s) => s.abstained).length,
        probes: experimentProbes.length,
      },
    };
  },
});

export const listExperimentSamples = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    return ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();
  },
});

export const listExperimentScores = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    return ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();
  },
});

export const listExperimentRubrics = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    return ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experimentId", experiment._id),
      )
      .collect();
  },
});

export const listExperimentProbes = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();
    const scoreIds = new Set(scores.map((s) => s._id));

    const probes = await ctx.db.query("probes").collect();
    return probes.filter((p) => scoreIds.has(p.scoreId));
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
    const window = await ctx.db.get(experiment.windowId);
    if (!window) throw new Error("Window not found");

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();
    const sampleById = new Map(samples.map((s) => [s._id, s]));

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experiment._id))
      .collect();

    // Flat denormalized rows for pandas
    return scores.map((score) => {
      const sample = sampleById.get(score.sampleId);
      return {
      experimentTag: experiment.experimentTag,
      modelId: score.modelId,
      concept: window.concept,
      taskType: experiment.taskType,
      scoringMethod: experiment.config.scoringMethod,
      scaleSize: experiment.config.scaleSize,
      randomizations: experiment.config.randomizations,
      evidenceView: experiment.config.evidenceView,
      promptOrdering: experiment.config.promptOrdering,
      sampleId: score.sampleId,
      rubricId: score.rubricId,
      evidenceId: score.evidenceId,
      isSwap: score.isSwap,
      abstained: score.abstained,
      rawVerdict: score.rawVerdict,
      decodedScores: score.decodedScores,
      displaySeed: sample?.displaySeed,
      labelMapping: sample?.labelMapping,
    };
    });
  },
});
