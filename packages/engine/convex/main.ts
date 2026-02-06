import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "./utils";
import { ExperimentsTableSchema, WindowsTableSchema } from "./schema";
import { internal } from "./_generated/api";
import { workflow } from "./workflow_manager";

// --- Setup ---

export const createWindow = zMutation({
  args: WindowsTableSchema,
  handler: async (ctx, args) => ctx.db.insert("windows", args),
});

export const createExperiment = zMutation({
  args: ExperimentsTableSchema.omit({ status: true }),
  handler: async (ctx, args) =>
    ctx.db.insert("experiments", { ...args, status: "pending" }),
});

// --- Workflow triggers ---

// W1: Evidence collection
export const startEvidencePipeline = zMutation({
  args: z.object({
    windowId: zid("windows"),
    experimentId: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (ctx, { windowId, experimentId, limit }) => {
    await workflow.start(
      ctx,
      internal.stages["1_evidence"].evidence_workflow.evidenceWorkflow,
      { windowId, experimentId, limit },
    );
  },
});

// W2: Rubric generation
export const startRubricGeneration = zMutation({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    await workflow.start(
      ctx,
      internal.stages["2_rubric"].rubric_workflow.rubricWorkflow,
      { experimentId },
    );
  },
});

// W3: Scoring trial
export const startScoringTrial = zMutation({
  args: z.object({
    experimentId: z.string(),
    samples: z.number().optional(),
  }),
  handler: async (ctx, { experimentId, samples }) => {
    await workflow.start(
      ctx,
      internal.stages["3_scoring"].scoring_workflow.scoringWorkflow,
      { experimentId, samples },
    );
  },
});

// W4: Rubric swap trial
export const startSwapTrial = zMutation({
  args: z.object({
    experimentId: z.string(),
    swapRubricFrom: z.string(),
  }),
  handler: async (ctx, { experimentId, swapRubricFrom }) => {
    await workflow.start(
      ctx,
      internal.stages["3_scoring"].scoring_workflow.swapWorkflow,
      { experimentId, swapRubricFrom },
    );
  },
});

// W5: Epistemic probing
export const startProbingTrial = zMutation({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, { experimentId }) => {
    await workflow.start(
      ctx,
      internal.stages["4_probe"].probe_workflow.probeWorkflow,
      { experimentId },
    );
  },
});
