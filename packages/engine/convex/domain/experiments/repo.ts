import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../platform/utils";
import {
  ExperimentStatusSchema,
  ParseStatusSchema,
} from "../../models/core";
import {
  EvidencesTableSchema,
  RubricsTableSchema,
  SamplesTableSchema,
  ScoresTableSchema,
} from "../../models/experiments";

// --- Experiments ---

export const getExperiment = zInternalQuery({
  args: z.object({ experiment_tag: z.string() }),
  handler: async (ctx, { experiment_tag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);
    return experiment;
  },
});

export const getExperimentById = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    return experiment;
  },
});

export const patchExperimentStatus = zInternalMutation({
  args: z.object({ experiment_tag: z.string(), status: ExperimentStatusSchema }),
  handler: async (ctx, { experiment_tag, status }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);
    await ctx.db.patch(experiment._id, { status });
  },
});

// --- Windows ---

export const getWindow = zInternalQuery({
  args: z.object({ window_id: zid("windows") }),
  handler: async (ctx, { window_id }) => {
    const window = await ctx.db.get(window_id);
    if (!window) throw new Error("Window not found");
    return window;
  },
});

// --- Evidence ---

export const createEvidence = zInternalMutation({
  args: EvidencesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("evidences", args),
});

export const getEvidence = zInternalQuery({
  args: z.object({ evidence_id: zid("evidences") }),
  handler: async (ctx, { evidence_id }) => {
    const evidence = await ctx.db.get(evidence_id);
    if (!evidence) throw new Error("Evidence not found");
    return evidence;
  },
});

export const patchEvidence = zInternalMutation({
  args: z.object({
    evidence_id: zid("evidences"),
    cleaned_content: z.string().optional(),
    neutralized_content: z.string().optional(),
    abstracted_content: z.string().optional(),
  }),
  handler: async (ctx, updates) => {
    const { evidence_id, ...fields } = updates;
    await ctx.db.patch(evidence_id, fields);
  },
});

export const listEvidenceByWindow = zInternalQuery({
  args: z.object({ window_id: zid("windows") }),
  handler: async (ctx, { window_id }) => {
    return ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
      .collect();
  },
});

export const listEvidenceByWindowSummary = zInternalQuery({
  args: z.object({ window_id: zid("windows"), limit: z.number().optional() }),
  handler: async (ctx, { window_id, limit }) => {
    const query = ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", window_id));
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
  args: z.object({ rubric_id: zid("rubrics") }),
  handler: async (ctx, { rubric_id }) => {
    const rubric = await ctx.db.get(rubric_id);
    if (!rubric) throw new Error("Rubric not found");
    return rubric;
  },
});

export const getRubricForExperiment = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    const rubric = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q
          .eq("experiment_id", experiment_id)
          .eq("model_id", experiment.config.rubric_stage.model_id),
      )
      .first();
    if (!rubric) throw new Error("Rubric not found for experiment");
    return rubric;
  },
});

export const listRubricsForExperiment = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    return ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) => q.eq("experiment_id", experiment_id))
      .collect();
  },
});

export const patchRubric = zInternalMutation({
  args: z.object({
    rubric_id: zid("rubrics"),
    rubric_critic_message_id: zid("llm_messages").optional(),
    rubric_critic_output: z.string().optional(),
    rubric_critic_reasoning: z.string().optional(),
    quality_stats: z
      .object({
        observability_score: z.number(),
        discriminability_score: z.number(),
      })
      .optional(),
    parse_error: z.string().optional(),
    parse_status: ParseStatusSchema.optional(),
    attempt_count: z.number().optional(),
  }),
  handler: async (ctx, { rubric_id, ...fields }) => {
    await ctx.db.patch(rubric_id, fields);
  },
});

// --- Samples ---

export const createSample = zInternalMutation({
  args: SamplesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("samples", args),
});

export const getSample = zInternalQuery({
  args: z.object({ sample_id: zid("samples") }),
  handler: async (ctx, { sample_id }) => {
    const sample = await ctx.db.get(sample_id);
    if (!sample) throw new Error("Sample not found");
    return sample;
  },
});

export const listSamplesByExperiment = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    return ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment_id))
      .collect();
  },
});

// --- Scores ---

export const createScore = zInternalMutation({
  args: ScoresTableSchema,
  handler: async (ctx, args) => ctx.db.insert("scores", args),
});

export const getScore = zInternalQuery({
  args: z.object({ score_id: zid("scores") }),
  handler: async (ctx, { score_id }) => {
    const score = await ctx.db.get(score_id);
    if (!score) throw new Error("Score not found");
    return score;
  },
});

export const listNonAbstainedScores = zInternalQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, { experiment_id }) => {
    const all = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment_id))
      .collect();
    return all.filter((s) => !s.abstained);
  },
});

export const patchScore = zInternalMutation({
  args: z.object({
    score_id: zid("scores"),
    score_critic_message_id: zid("llm_messages").optional(),
    score_critic_output: z.string().optional(),
    score_critic_reasoning: z.string().optional(),
    expert_agreement_prob: z.number().optional(),
    parse_error: z.string().optional(),
    parse_status: ParseStatusSchema.optional(),
    attempt_count: z.number().optional(),
  }),
  handler: async (ctx, { score_id, ...fields }) => {
    await ctx.db.patch(score_id, fields);
  },
});
