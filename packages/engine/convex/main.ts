import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "./utils";
import { ExperimentsTableSchema, WindowsTableSchema } from "./schema";

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
// These will be wired up as stages are implemented.
// Each trigger starts a workflow from the workflow-manager.

// W1: Evidence collection
export const startEvidencePipeline = zMutation({
  args: z.object({
    windowId: zid("windows"),
    experimentId: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (ctx, args) => {
    // TODO: wire to evidenceWorkflow
    throw new Error("Not yet implemented — build stages/1_evidence/ first");
  },
});

// W2: Rubric generation
export const startRubricGeneration = zMutation({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, args) => {
    // TODO: wire to rubricWorkflow
    throw new Error("Not yet implemented — build stages/2_rubric/ first");
  },
});

// W3: Scoring trial
export const startScoringTrial = zMutation({
  args: z.object({
    experimentId: z.string(),
    samples: z.number().optional(),
  }),
  handler: async (ctx, args) => {
    // TODO: wire to scoringWorkflow
    throw new Error("Not yet implemented — build stages/3_scoring/ first");
  },
});

// W4: Rubric swap trial
export const startSwapTrial = zMutation({
  args: z.object({
    experimentId: z.string(),
    swapRubricFrom: z.string(),
  }),
  handler: async (ctx, args) => {
    // TODO: wire to swapWorkflow
    throw new Error("Not yet implemented — build stages/3_scoring/ first");
  },
});

// W5: Epistemic probing
export const startProbingTrial = zMutation({
  args: z.object({ experimentId: z.string() }),
  handler: async (ctx, args) => {
    // TODO: wire to probeWorkflow
    throw new Error("Not yet implemented — build stages/4_probe/ first");
  },
});
