"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import { Prober } from "./probe_agent";
import { resolveScaleStrategy } from "../../strategies/scale.strategy";
import { resolveRandomizationStrategy } from "../../strategies/randomization.strategy";

// --- Probe a single score for epistemic calibration ---
export const probeOneSample = zInternalAction({
  args: z.object({ scoreId: zid("scores") }),
  handler: async (ctx, { scoreId }) => {
    const score = await ctx.runQuery(internal.repo.getScore, { scoreId });
    const rubric = await ctx.runQuery(internal.repo.getRubric, {
      rubricId: score.rubricId,
    });
    const sample = await ctx.runQuery(internal.repo.getSample, {
      sampleId: score.sampleId,
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

    const { letterLabels } = resolveScaleStrategy(experiment.config);
    const labelMapping = sample.labelMapping ?? undefined;
    const randomization = resolveRandomizationStrategy(experiment.config);

    const labelForIndex = (index: number) => {
      if (!randomization.hideLabelName) {
        return rubric.stages[index]?.label ?? letterLabels[index];
      }
      if (labelMapping) {
        return (
          Object.entries(labelMapping).find(([, v]) => v === index + 1)?.[0] ??
          letterLabels[index]
        );
      }
      return letterLabels[index];
    };

    const stagesForPrompt = rubric.stages.map((s, i) => ({
      label: labelForIndex(i),
      criteria: s.criteria,
    }));

    const orderedStages = randomization.rubricOrderShuffle
      ? [...stagesForPrompt].sort(() => Math.random() - 0.5)
      : stagesForPrompt;

    const verdictLabels = score.decodedScores?.map((scoreValue) =>
      labelForIndex(scoreValue - 1),
    );
    if (!verdictLabels || verdictLabels.length === 0) return;

    // Use the SAME model as the scorer, but in a FRESH thread
    const prober = new Prober(experiment.modelId);
    const result = await prober.probe(ctx, {
      experimentTag: experiment.experimentTag,
      scoreId: score._id.toString(),
      rubric: orderedStages,
      evidenceSummary: evidence.neutralizedContent ?? evidence.rawContent,
      modelOutput: score.rawVerdict ?? "",
      verdictLabels,
      labelsAnonymized: randomization.hideLabelName,
    });

    await ctx.runMutation(internal.repo.createProbe, {
      scoreId,
      modelId: experiment.modelId,
      threadId: result.threadId,
      promptedStageLabel: verdictLabels.join(", "),
      expertAgreementProb: result.expertAgreementProb,
    });
  },
});
