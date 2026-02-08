import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "./utils";
import { ExperimentsTableSchema, WindowsTableSchema } from "./schema";
import { internal } from "./_generated/api";
import { workflow } from "./workflow_manager";

// --- Setup ---

export const initExperiment = zMutation({
  args: z.object({
    window: WindowsTableSchema,
    experiment: ExperimentsTableSchema.omit({ status: true, windowId: true }),
  }),
  handler: async (ctx, { window, experiment }) => {
    const existingExperiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experimentTag", experiment.experimentTag),
      )
      .unique();
    if (existingExperiment) {
      const existingWindow = await ctx.db.get(existingExperiment.windowId);
      if (!existingWindow) throw new Error("Window not found");
      if (
        existingWindow.startDate !== window.startDate ||
        existingWindow.endDate !== window.endDate ||
        existingWindow.country !== window.country ||
        existingWindow.concept !== window.concept
      ) {
        throw new Error(
          `Window mismatch for experimentTag=${experiment.experimentTag}`,
        );
      }
      return {
        windowId: existingExperiment.windowId,
        experimentId: existingExperiment._id,
        reusedWindow: true,
        reusedExperiment: true,
      };
    }

    const existingWindow = await ctx.db
      .query("windows")
      .withIndex("by_window_key", (q) =>
        q
          .eq("startDate", window.startDate)
          .eq("endDate", window.endDate)
          .eq("country", window.country)
          .eq("concept", window.concept),
      )
      .first();

    const windowId = existingWindow?._id ?? (await ctx.db.insert("windows", window));
    const experimentId = await ctx.db.insert("experiments", {
      ...experiment,
      windowId,
      status: "pending",
    });

    return {
      windowId,
      experimentId,
      reusedWindow: Boolean(existingWindow),
      reusedExperiment: false,
    };
  },
});

// --- Workflow triggers ---

// W1: Evidence collection
export const startEvidencePipeline = zMutation({
  args: z.object({
    windowId: zid("windows"),
    experimentTag: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (ctx, { windowId, experimentTag, limit }) => {
    await workflow.start(
      ctx,
      internal.stages["1_evidence"].evidence_workflow.evidenceWorkflow,
      { windowId, experimentTag, limit },
    );
  },
});

// W2: Rubric generation
export const startRubricGeneration = zMutation({
  args: z.object({ experimentTag: z.string(), samples: z.number().optional() }),
  handler: async (ctx, { experimentTag, samples }) => {
    await workflow.start(
      ctx,
      internal.stages["2_rubric"].rubric_workflow.rubricWorkflow,
      { experimentTag, samples },
    );
  },
});

// W3: Scoring trial
export const startScoringTrial = zMutation({
  args: z.object({
    experimentTag: z.string(),
    samples: z.number().optional(),
    evidenceLimit: z.number().optional(),
  }),
  handler: async (ctx, { experimentTag, samples, evidenceLimit }) => {
    await workflow.start(
      ctx,
      internal.stages["3_scoring"].scoring_workflow.scoringWorkflow,
      { experimentTag, samples, evidenceLimit },
    );
  },
});

// W4: Rubric swap trial
export const startSwapTrial = zMutation({
  args: z.object({
    experimentTag: z.string(),
    swapRubricFrom: z.string(),
    evidenceLimit: z.number().optional(),
  }),
  handler: async (ctx, { experimentTag, swapRubricFrom, evidenceLimit }) => {
    await workflow.start(
      ctx,
      internal.stages["3_scoring"].scoring_workflow.swapWorkflow,
      { experimentTag, swapRubricFrom, evidenceLimit },
    );
  },
});
