import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "./utils";
import {
  EvidenceTableSchema,
  ExperimentStatusSchema,
  RubricsTableSchema,
  SamplesTableSchema,
  ScoresTableSchema,
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

export const getExperimentById = zInternalQuery({
  args: z.object({ experimentId: zid("experiments") }),
  handler: async (ctx, { experimentId }) => {
    const experiment = await ctx.db.get(experimentId);
    if (!experiment) throw new Error("Experiment not found");
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
  handler: async (ctx, args) => ctx.db.insert("evidences", args),
});

export const getEvidence = zInternalQuery({
  args: z.object({ evidenceId: zid("evidences") }),
  handler: async (ctx, { evidenceId }) => {
    const evidence = await ctx.db.get(evidenceId);
    if (!evidence) throw new Error("Evidence not found");
    return evidence;
  },
});

export const patchEvidence = zInternalMutation({
  args: z.object({
    evidenceId: zid("evidences"),
    cleanedContent: z.string().optional(),
    neutralizedContent: z.string().optional(),
    abstractedContent: z.string().optional(),
  }),
  handler: async (ctx, updates) => {
    const { evidenceId, ...fields } = updates;
    await ctx.db.patch(evidenceId, fields);
  },
});

export const listEvidenceByWindow = zInternalQuery({
  args: z.object({ windowId: zid("windows") }),
  handler: async (ctx, { windowId }) => {
    return ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("windowId", windowId))
      .collect();
  },
});

export const listEvidenceByWindowSummary = zInternalQuery({
  args: z.object({ windowId: zid("windows"), limit: z.number().optional() }),
  handler: async (ctx, { windowId, limit }) => {
    const query = ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("windowId", windowId));
    const rows = limit ? await query.take(limit) : await query.collect();
    return rows.map((row) => ({ title: row.title, url: row.url }));
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
  args: z.object({ experimentId: zid("experiments") }),
  handler: async (ctx, { experimentId }) => {
    const experiment = await ctx.db.get(experimentId);
    if (!experiment) throw new Error("Experiment not found");
    const rubric = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experimentId", experimentId).eq("modelId", experiment.modelId),
      )
      .first();
    if (!rubric) throw new Error("Rubric not found for experiment");
    return rubric;
  },
});

export const listRubricsForExperiment = zInternalQuery({
  args: z.object({ experimentId: zid("experiments") }),
  handler: async (ctx, { experimentId }) => {
    return ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) => q.eq("experimentId", experimentId))
      .collect();
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

export const listSamplesByExperiment = zInternalQuery({
  args: z.object({ experimentId: zid("experiments") }),
  handler: async (ctx, { experimentId }) => {
    return ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();
  },
});

// --- Scores ---

export const createScore = zInternalMutation({
  args: ScoresTableSchema,
  handler: async (ctx, args) => ctx.db.insert("scores", args),
});

export const getScore = zInternalQuery({
  args: z.object({ scoreId: zid("scores") }),
  handler: async (ctx, { scoreId }) => {
    const score = await ctx.db.get(scoreId);
    if (!score) throw new Error("Score not found");
    return score;
  },
});

export const listNonAbstainedScores = zInternalQuery({
  args: z.object({ experimentId: zid("experiments") }),
  handler: async (ctx, { experimentId }) => {
    const all = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();
    return all.filter((s) => !s.abstained);
  },
});

export const patchScore = zInternalMutation({
  args: z.object({
    scoreId: zid("scores"),
    probeThreadId: z.string().optional(),
    promptedStageLabel: z.string().optional(),
    expertAgreementProb: z.number().optional(),
  }),
  handler: async (ctx, updates) => {
    const { scoreId, ...fields } = updates;
    await ctx.db.patch(scoreId, fields);
  },
});

export const listScoresByExperiment = zInternalQuery({
  args: z.object({ experimentId: zid("experiments") }),
  handler: async (ctx, { experimentId }) => {
    return ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experimentId", experimentId))
      .collect();
  },
});

// --- Usage ---

export const createUsage = zInternalMutation({
  args: UsageTableSchema,
  handler: async (ctx, args) => ctx.db.insert("usages", args),
});
