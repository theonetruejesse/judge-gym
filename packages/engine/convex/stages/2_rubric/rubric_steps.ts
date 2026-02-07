"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { Rubricer, Critic } from "./rubric_agent";

// --- Generate rubric via LLM ---
export const generateRubric = zInternalAction({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }): Promise<Id<"rubrics">> => {
    const experiment = await ctx.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });
    const window = await ctx.runQuery(internal.repo.getWindow, {
      windowId: experiment.windowId,
    });

    const rubricer = new Rubricer(experiment.modelId);
    const rubric = await rubricer.generateRubric(ctx, {
      experimentTag,
      concept: experiment.concept,
      country: window.country,
      scaleSize: experiment.config.scaleSize,
    });

    const rubricId = await ctx.runMutation(internal.repo.createRubric, {
      experimentTag,
      modelId: experiment.modelId,
      concept: experiment.concept,
      scaleSize: experiment.config.scaleSize,
      stages: rubric.stages,
      reasoning: rubric.reasoning,
      qualityStats: { observabilityScore: 0, discriminabilityScore: 0 }, // filled by critic
    });

    return rubricId;
  },
});

// --- Validate rubric quality ---
export const validateRubric = zInternalAction({
  args: z.object({ rubricId: zid("rubrics") }),
  handler: async (ctx, { rubricId }) => {
    const rubric = await ctx.runQuery(internal.repo.getRubric, { rubricId });

    const critic = new Critic();
    const quality = await critic.evaluate(ctx, rubric);

    await ctx.runMutation(internal.repo.patchRubric, {
      rubricId,
      qualityStats: quality,
    });
  },
});

// --- Load pre-defined benchmark rubric ---
export const loadBenchmarkRubric = zInternalAction({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }): Promise<Id<"rubrics">> => {
    // Load rubric from Convex storage — pre-uploaded during setup
    throw new Error("TODO: implement benchmark rubric loading");
  },
});
