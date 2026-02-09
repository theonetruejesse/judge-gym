import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { Rubricer, Critic } from "./rubric_agent";

// --- Generate rubric via LLM ---
export const generateRubric = zInternalAction({
  args: z.object({ experimentTag: z.string() }),
  returns: zid("rubrics"),
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
      concept: window.concept,
      scaleSize: experiment.config.scaleSize,
    });

    const rubricId = await ctx.runMutation(internal.repo.createRubric, {
      experimentId: experiment._id,
      modelId: experiment.modelId,
      concept: window.concept,
      scaleSize: experiment.config.scaleSize,
      stages: rubric.stages,
      reasoning: rubric.reasoning,
      rubricerThreadId: rubric.threadId,
      rubricerOutput: rubric.rawOutput,
      qualityStats: { observabilityScore: 0, discriminabilityScore: 0 }, // filled by critic
    });

    return rubricId;
  },
});

// --- Validate rubric quality ---
export const validateRubric = zInternalAction({
  args: z.object({ rubricId: zid("rubrics") }),
  returns: z.null(),
  handler: async (ctx, { rubricId }) => {
    const rubric = await ctx.runQuery(internal.repo.getRubric, { rubricId });

    const critic = new Critic(rubric.modelId);
    const quality = await critic.evaluate(ctx, rubric);

    await ctx.runMutation(internal.repo.patchRubric, {
      rubricId,
      qualityStats: {
        observabilityScore: quality.observabilityScore,
        discriminabilityScore: quality.discriminabilityScore,
      },
      criticThreadId: quality.threadId,
      criticOutput: quality.rawOutput,
      criticReasoning: quality.reasoning,
    });
    return null;
  },
});

// --- Load pre-defined benchmark rubric ---
export const loadBenchmarkRubric = zInternalAction({
  args: z.object({ experimentTag: z.string() }),
  returns: zid("rubrics"),
  handler: async (ctx, { experimentTag }): Promise<Id<"rubrics">> => {
    // Load rubric from Convex storage — pre-uploaded during setup
    throw new Error("TODO: implement benchmark rubric loading");
  },
});
