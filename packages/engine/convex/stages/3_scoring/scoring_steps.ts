import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import { Scorer } from "./scoring_agent";
import { Prober } from "./probe_agent";
import { resolveScaleStrategy } from "../../strategies/scale.strategy";
import { resolveRandomizationStrategy } from "../../strategies/randomization.strategy";
import { resolveEvidenceStrategy } from "../../strategies/evidence.strategy";

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Score a single evidence item against a rubric ---
export const scoreEvidence = zInternalAction({
  args: z.object({
    sampleId: zid("samples"),
    evidenceId: zid("evidences"),
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

    const scoreId = await ctx.runMutation(internal.repo.createScore, {
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

    if (result.abstained || !result.decodedScores?.length) return;

    const { letterLabels } = resolveScaleStrategy(experiment.config);
    const labelMapping = sample.labelMapping ?? undefined;
    const randomization = resolveRandomizationStrategy(experiment.config);
    const evidenceStrategy = resolveEvidenceStrategy(experiment.config);

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
      ? shuffleArray([...stagesForPrompt])
      : stagesForPrompt;

    const verdictLabels = result.decodedScores.map((scoreValue) =>
      labelForIndex(scoreValue - 1),
    );
    if (verdictLabels.length === 0) return;

    const prober = new Prober(experiment.modelId);
    const evidenceSummary =
      evidence[evidenceStrategy.contentField] ?? evidence.rawContent;
    const probeResult = await prober.probe(ctx, {
      experimentTag: experiment.experimentTag,
      scoreId: scoreId.toString(),
      rubric: orderedStages,
      evidenceSummary,
      modelOutput: result.rawVerdict ?? "",
      verdictLabels,
      labelsAnonymized: randomization.hideLabelName,
    });

    await ctx.runMutation(internal.repo.patchScore, {
      scoreId,
      probeThreadId: probeResult.threadId,
      promptedStageLabel: verdictLabels.join(", "),
      expertAgreementProb: probeResult.expertAgreementProb,
    });
  },
});
