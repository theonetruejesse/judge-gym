import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import { Scorer } from "./scoring_agent";

// --- Score a single evidence item against a rubric ---
export const scoreEvidence = zInternalAction({
  args: z.object({
    sampleId: zid("samples"),
    evidenceId: zid("evidence"),
  }),
  handler: async (ctx, { sampleId, evidenceId }) => {
    const sample = await ctx.runQuery(internal.repo.getSample, { sampleId });
    const experiment = await ctx.runQuery(internal.repo.getExperimentById, {
      experimentId: sample.experimentId,
    });
    const rubric = await ctx.runQuery(internal.repo.getRubric, {
      rubricId: sample.rubricId,
    });
    const evidence = await ctx.runQuery(internal.repo.getEvidence, {
      evidenceId,
    });

    // Resolve strategies once at agent construction
    const scorer = new Scorer(experiment.modelId, experiment.config);

    const result = await scorer.score(ctx, {
      experimentTag: experiment.experimentTag,
      rubric,
      evidence,
      labelMapping: sample.labelMapping ?? undefined,
    });

    await ctx.runMutation(internal.repo.createScore, {
      sampleId: sample._id,
      experimentId: experiment._id,
      modelId: experiment.modelId,
      rubricId: rubric._id,
      evidenceId,
      threadId: result.threadId,
      isSwap: sample.isSwap,
      abstained: result.abstained,
      rawVerdict: result.rawVerdict,
      decodedScores: result.decodedScores,
    });
  },
});
