"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import { Prober } from "./probe_agent";

// --- Probe a single scored sample for epistemic calibration ---
export const probeOneSample = zInternalAction({
  args: z.object({ sampleId: zid("samples") }),
  handler: async (ctx, { sampleId }) => {
    const sample = await ctx.runQuery(internal.repo.getSample, { sampleId });
    const rubric = await ctx.runQuery(internal.repo.getRubric, {
      rubricId: sample.rubricId,
    });
    const evidence = await ctx.runQuery(internal.repo.getEvidence, {
      evidenceId: sample.evidenceId,
    });
    const experiment = await ctx.runQuery(internal.repo.getExperiment, {
      experimentId: sample.experimentId,
    });

    // Resolve the stage label that was selected
    const primaryScore = sample.decodedScores?.[0];
    if (primaryScore == null) return; // can't probe null verdict

    const stageIndex = primaryScore - 1; // 1-indexed → 0-indexed
    const stage = rubric.stages[stageIndex];
    if (!stage) return;

    // Use the SAME model as the scorer, but in a FRESH thread
    const prober = new Prober(experiment.modelId);
    const result = await prober.probe(ctx, {
      experimentId: sample.experimentId,
      sampleId: sample._id.toString(),
      stageLabel: stage.label,
      stageCriteria: stage.criteria,
      evidenceSummary: evidence.neutralizedContent ?? evidence.rawContent,
    });

    await ctx.runMutation(internal.repo.createProbe, {
      sampleId,
      modelId: experiment.modelId,
      threadId: result.threadId,
      promptedStageLabel: stage.label,
      expertAgreementProb: result.expertAgreementProb,
    });
  },
});
