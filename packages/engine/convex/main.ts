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

    return { windowId, experimentId, reusedWindow: Boolean(existingWindow) };
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
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    await workflow.start(
      ctx,
      internal.stages["2_rubric"].rubric_workflow.rubricWorkflow,
      { experimentTag },
    );
  },
});

// W3: Scoring trial
export const startScoringTrial = zMutation({
  args: z.object({
    experimentTag: z.string(),
    samples: z.number().optional(),
  }),
  handler: async (ctx, { experimentTag, samples }) => {
    await workflow.start(
      ctx,
      internal.stages["3_scoring"].scoring_workflow.scoringWorkflow,
      { experimentTag, samples },
    );
  },
});

// W4: Rubric swap trial
export const startSwapTrial = zMutation({
  args: z.object({
    experimentTag: z.string(),
    swapRubricFrom: z.string(),
  }),
  handler: async (ctx, { experimentTag, swapRubricFrom }) => {
    await workflow.start(
      ctx,
      internal.stages["3_scoring"].scoring_workflow.swapWorkflow,
      { experimentTag, swapRubricFrom },
    );
  },
});

// W5: Epistemic probing
export const startProbingTrial = zMutation({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    await workflow.start(
      ctx,
      internal.stages["4_probe"].probe_workflow.probeWorkflow,
      { experimentTag },
    );
  },
});
