import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "./utils";
import {
  EvidenceTableSchema,
  ExperimentStatusSchema,
  RubricsTableSchema,
  SamplesTableSchema,
  ProbesTableSchema,
  UsageTableSchema,
} from "./schema";

// --- Experiments ---

export const getExperiment = zInternalQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    return experiment;
  },
});

export const patchExperiment = zInternalMutation({
  args: z.object({ experimentTag: z.string(), status: ExperimentStatusSchema }),
  handler: async (ctx, { experimentTag, status }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    await ctx.db.patch(experiment._id, { status });
  },
});

// --- Windows ---

export const getWindow = zInternalQuery({
  args: z.object({ windowId: zid("windows") }),
  handler: async (ctx, { windowId }) => {
    const window = await ctx.db.get(windowId);
    if (!window) throw new Error("Window not found");
    return window;
  },
});

// --- Evidence ---

export const createEvidence = zInternalMutation({
  args: EvidenceTableSchema,
  handler: async (ctx, args) => ctx.db.insert("evidence", args),
});

export const getEvidence = zInternalQuery({
  args: z.object({ evidenceId: zid("evidence") }),
  handler: async (ctx, { evidenceId }) => {
    const evidence = await ctx.db.get(evidenceId);
    if (!evidence) throw new Error("Evidence not found");
    return evidence;
  },
});

export const patchEvidence = zInternalMutation({
  args: z.object({
    evidenceId: zid("evidence"),
    neutralizedContent: z.string(),
  }),
  handler: async (ctx, { evidenceId, neutralizedContent }) => {
    await ctx.db.patch(evidenceId, { neutralizedContent });
  },
});

export const listEvidenceByWindow = zInternalQuery({
  args: z.object({ windowId: zid("windows") }),
  handler: async (ctx, { windowId }) => {
    return ctx.db
      .query("evidence")
      .withIndex("by_window_id", (q) => q.eq("windowId", windowId))
      .collect();
  },
});

// --- Rubrics ---

export const createRubric = zInternalMutation({
  args: RubricsTableSchema,
  handler: async (ctx, args) => ctx.db.insert("rubrics", args),
});

export const getRubric = zInternalQuery({
  args: z.object({ rubricId: zid("rubrics") }),
  handler: async (ctx, { rubricId }) => {
    const rubric = await ctx.db.get(rubricId);
    if (!rubric) throw new Error("Rubric not found");
    return rubric;
  },
});

export const getRubricForExperiment = zInternalQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();
    if (!experiment) throw new Error("Experiment not found");
    const rubric = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experimentTag", experimentTag).eq("modelId", experiment.modelId),
      )
      .first();
    if (!rubric) throw new Error("Rubric not found for experiment");
    return rubric;
  },
});

export const getRubricByModelAndConcept = zInternalQuery({
  args: z.object({ modelId: z.string(), concept: z.string() }),
  handler: async (ctx, { modelId, concept }) => {
    // Search across all rubrics for a matching model + concept
    const rubrics = await ctx.db.query("rubrics").collect();
    const match = rubrics.find(
      (r) => r.modelId === modelId && r.concept === concept,
    );
    if (!match)
      throw new Error(`Rubric not found for model=${modelId}, concept=${concept}`);
    return match;
  },
});

export const patchRubric = zInternalMutation({
  args: z.object({
    rubricId: zid("rubrics"),
    qualityStats: z.object({
      observabilityScore: z.number(),
      discriminabilityScore: z.number(),
    }),
  }),
  handler: async (ctx, { rubricId, qualityStats }) => {
    await ctx.db.patch(rubricId, { qualityStats });
  },
});

// --- Samples ---

export const createSample = zInternalMutation({
  args: SamplesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("samples", args),
});

export const getSample = zInternalQuery({
  args: z.object({ sampleId: zid("samples") }),
  handler: async (ctx, { sampleId }) => {
    const sample = await ctx.db.get(sampleId);
    if (!sample) throw new Error("Sample not found");
    return sample;
  },
});

export const listNonAbstainedSamples = zInternalQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const all = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentTag", experimentTag))
      .collect();
    return all.filter((s) => !s.abstained);
  },
});

// --- Probes ---

export const createProbe = zInternalMutation({
  args: ProbesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("probes", args),
});

// --- Usage ---

export const createUsage = zInternalMutation({
  args: UsageTableSchema,
  handler: async (ctx, args) => ctx.db.insert("usage", args),
});
