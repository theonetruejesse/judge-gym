import z from "zod";
import { zQuery } from "./utils";
import { components } from "./_generated/api";

// --- Read queries for analysis consumption ---


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

    const experimentProbes = scores.filter(
      (s) => s.expertAgreementProb !== undefined,
    );

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

// Kept for internal engine use (e.g. tracker.ts).

export const listExperimentsByTaskType = zQuery({
  args: z.object({ taskType: z.string() }),
  handler: async (ctx, { taskType }) => {
    return ctx.db
      .query("experiments")
      .withIndex("by_task_type", (q) =>
        q.eq("taskType", taskType as "ecc" | "control" | "benchmark"),
      )
      .collect();
  },
});

export const listAgentThreadMessages = zQuery({
  args: z.object({
    threadId: z.string(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().min(1).max(200).optional(),
    excludeToolMessages: z.boolean().optional(),
    statuses: z.array(z.enum(["pending", "success", "failed"])).optional(),
  }),
  handler: async (
    ctx,
    { threadId, order, limit, excludeToolMessages, statuses },
  ) => {
    const pageSize = limit ?? 100;
    const result = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId,
        order: order ?? "asc",
        excludeToolMessages,
        statuses,
        paginationOpts: {
          cursor: null,
          numItems: pageSize,
        },
      },
    );
    return result.page;
  },
});

// ---------------------------------------------------------------------------
// Bulk export consumed by the Python analysis package (judge_gym.collect).
//
// One HTTP call per experiment — returns everything needed to build DataFrames:
//   - experiment: tag, model, concept, config, status
//   - evidence:   id + title for each evidence article
//   - scores:     flat rows (score fields + sample display fields)
// ---------------------------------------------------------------------------

export const exportExperimentBundle = zQuery({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    // --- Experiment + window ---
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experimentTag", experimentTag),
      )
      .unique();
    if (!experiment) throw new Error(`Experiment not found: ${experimentTag}`);
    const window = await ctx.db.get(experiment.windowId);
    if (!window) throw new Error("Window not found");

    // --- Samples (for displaySeed / labelMapping) ---
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) =>
        q.eq("experimentId", experiment._id),
      )
      .collect();
    const sampleById = new Map(samples.map((s) => [s._id, s]));

    // --- Scores ---
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) =>
        q.eq("experimentId", experiment._id),
      )
      .collect();

    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experimentId", experiment._id),
      )
      .collect();

    // --- Evidence (unique IDs from scores → fetch titles) ---
    const evidenceIds = [...new Set(scores.map((s) => s.evidenceId))];
    const evidences = await Promise.all(
      evidenceIds.map(async (eid) => {
        const doc = await ctx.db.get(eid);
        return {
          evidenceId: eid,
          title: doc?.title ?? eid,
          url: doc?.url ?? "",
        };
      }),
    );

    // --- Flat score rows (analysis-ready) ---
    const scoreRows = scores.map((score) => {
      const sample = sampleById.get(score.sampleId);
      return {
        evidenceId: score.evidenceId,
        rubricId: score.rubricId,
        sampleId: score.sampleId,
        isSwap: score.isSwap,
        abstained: score.abstained,
        decodedScores: score.decodedScores,
        expertAgreementProb: score.expertAgreementProb,
        rawVerdict: score.rawVerdict,
        displaySeed: sample?.displaySeed,
        labelMapping: sample?.labelMapping,
      };
    });

    return {
      experiment: {
        experimentTag: experiment.experimentTag,
        modelId: experiment.modelId,
        concept: window.concept,
        taskType: experiment.taskType,
        status: experiment.status,
        config: experiment.config,
      },
      evidences,
      rubrics: rubrics.map((rubric) => ({
        rubricId: rubric._id,
        modelId: rubric.modelId,
        concept: rubric.concept,
        scaleSize: rubric.scaleSize,
        stages: rubric.stages,
        qualityStats: rubric.qualityStats,
      })),
      scores: scoreRows,
    };
  },
});
