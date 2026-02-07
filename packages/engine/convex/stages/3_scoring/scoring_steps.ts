"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import { Scorer } from "./scoring_agent";
import { generateLabelMapping } from "./scoring_randomize";

// --- Score a single evidence item against a rubric ---
export const scoreEvidence = zInternalAction({
  args: z.object({
    experimentTag: z.string(),
    evidenceId: zid("evidence"),
    rubricId: zid("rubrics"),
    isSwap: z.boolean(),
    displaySeed: z.number().optional(),
  }),
  handler: async (
    ctx,
    { experimentTag, evidenceId, rubricId, isSwap, displaySeed },
  ) => {
    const experiment = await ctx.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });
    const rubric = await ctx.runQuery(internal.repo.getRubric, { rubricId });
    const evidence = await ctx.runQuery(internal.repo.getEvidence, {
      evidenceId,
    });

    // Resolve strategies once at agent construction
    const scorer = new Scorer(experiment.modelId, experiment.config);

    // Generate label mapping if randomization is enabled
    const labelMapping = experiment.config.randomizeLabels
      ? generateLabelMapping(experiment.config.scaleSize, displaySeed)
      : undefined;

    const result = await scorer.score(ctx, {
      experimentTag,
      rubric,
      evidence,
      labelMapping,
    });

    await ctx.runMutation(internal.repo.createSample, {
      experimentId: experiment._id,
      modelId: experiment.modelId,
      rubricId,
      evidenceId,
      threadId: result.threadId,
      isSwap,
      labelMapping: labelMapping ?? undefined,
      displaySeed,
      abstained: result.abstained,
      rawVerdict: result.rawVerdict,
      decodedScores: result.decodedScores,
    });
  },
});
