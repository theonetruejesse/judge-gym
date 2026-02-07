"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import { Prober } from "./probe_agent";

// --- Probe a single score for epistemic calibration ---
export const probeOneSample = zInternalAction({
  args: z.object({ scoreId: zid("scores") }),
  handler: async (ctx, { scoreId }) => {
    const score = await ctx.runQuery(internal.repo.getScore, { scoreId });
    const rubric = await ctx.runQuery(internal.repo.getRubric, {
      rubricId: score.rubricId,
    });
    const evidence = await ctx.runQuery(internal.repo.getEvidence, {
      evidenceId: score.evidenceId,
    });
    const experiment = await ctx.runQuery(internal.repo.getExperimentById, {
      experimentId: score.experimentId,
    });

    // Resolve the stage label that was selected
    const primaryScore = score.decodedScores?.[0];
    if (primaryScore == null) return; // can't probe null verdict

    const stageIndex = primaryScore - 1; // 1-indexed → 0-indexed
    const stage = rubric.stages[stageIndex];
    if (!stage) return;

    // Use the SAME model as the scorer, but in a FRESH thread
    const prober = new Prober(experiment.modelId);
    const result = await prober.probe(ctx, {
      experimentTag: experiment.experimentTag,
      scoreId: score._id.toString(),
      stageLabel: stage.label,
      stageCriteria: stage.criteria,
      evidenceSummary: evidence.neutralizedContent ?? evidence.rawContent,
    });

    await ctx.runMutation(internal.repo.createProbe, {
      scoreId,
      modelId: experiment.modelId,
      threadId: result.threadId,
      promptedStageLabel: stage.label,
      expertAgreementProb: result.expertAgreementProb,
    });
  },
});
