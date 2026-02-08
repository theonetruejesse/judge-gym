import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { workflow } from "../../workflow_manager";
import { generateLabelMapping } from "../../utils/randomize";
import { resolveRandomizationStrategy } from "../../strategies/randomization.strategy";

export const scoringWorkflow = workflow.define({
  args: {
    experimentTag: v.string(),
    samples: v.optional(v.number()),
  },
  handler: async (
    step,
    { experimentTag, samples },
  ): Promise<{ scored: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });
    const windowDoc = await step.runQuery(internal.repo.getWindow, {
      windowId: experiment.windowId,
    });
    const evidenceList = await step.runQuery(
      internal.repo.listEvidenceByWindow,
      { windowId: experiment.windowId },
    );
    const rubrics = await step.runQuery(internal.repo.listRubricsForExperiment, {
      experimentId: experiment._id,
    });
    const n = samples ?? 5;
    if (rubrics.length < n) {
      throw new Error(
        `Not enough rubrics for ${experimentTag}: have ${rubrics.length}, need ${n}. ` +
          "Run startRubricGeneration with samples=n first.",
      );
    }

    const existingSamples = await step.runQuery(
      internal.repo.listSamplesByExperiment,
      { experimentId: experiment._id },
    );
    const sampleIds: Array<Id<"samples">> = existingSamples
      .slice(0, n)
      .map((s) => s._id);
    const usedRubricIds = new Set(existingSamples.map((s) => s.rubricId));
    const needed = n - sampleIds.length;

    if (needed > 0) {
      const availableRubrics = rubrics.filter(
        (r) => !usedRubricIds.has(r._id),
      );
      if (availableRubrics.length < needed) {
        throw new Error(
          `Insufficient unused rubrics for ${experimentTag}: need ${needed}, have ${availableRubrics.length}.`,
        );
      }
      const randomization = resolveRandomizationStrategy(experiment.config);
      for (let i = 0; i < needed; i += 1) {
        const rubric = availableRubrics[i];
        const seed = sampleIds.length + i;
        const labelMapping = randomization.anonLabel
          ? generateLabelMapping(experiment.config.scaleSize, seed)
          : undefined;
        const sampleId = await step.runMutation(internal.repo.createSample, {
          experimentId: experiment._id,
          modelId: experiment.modelId,
          rubricId: rubric._id,
          isSwap: false,
          labelMapping: labelMapping ?? undefined,
          displaySeed: randomization.anonLabel ? seed : undefined,
        });
        sampleIds.push(sampleId);
      }
    }

    const existingScores = await step.runQuery(
      internal.repo.listScoresByExperiment,
      { experimentId: experiment._id },
    );
    const scoredKeys = new Set(
      existingScores.map((s) => `${s.sampleId}:${s.evidenceId}`),
    );

    const workItems = sampleIds.flatMap((sampleId) =>
      evidenceList
        .map((evidence) => ({
          sampleId,
          evidenceId: evidence._id,
        }))
        .filter((item) => !scoredKeys.has(`${item.sampleId}:${item.evidenceId}`)),
    );
    const batchSize = 10;

    let scored = 0;
    for (let i = 0; i < workItems.length; i += batchSize) {
      const chunk = workItems.slice(i, i + batchSize);
      await Promise.all(
        chunk.map((item) =>
          step.runAction(
            internal.stages["3_scoring"].scoring_steps.scoreEvidence,
            {
              sampleId: item.sampleId,
              evidenceId: item.evidenceId,
            },
          ),
        ),
      );
      scored += chunk.length;
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentTag,
      status: "scoring",
    });

    return { scored };
  },
});

export const swapWorkflow = workflow.define({
  args: {
    experimentTag: v.string(),
    swapRubricFrom: v.string(), // modelId of the rubric source
  },
  handler: async (
    step,
    { experimentTag, swapRubricFrom },
  ): Promise<{ scored: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });
    const windowDoc = await step.runQuery(internal.repo.getWindow, {
      windowId: experiment.windowId,
    });
    const evidenceList = await step.runQuery(
      internal.repo.listEvidenceByWindow,
      { windowId: experiment.windowId },
    );

    // Find the rubric from the swap source model's experiment
    const swapRubric = await step.runQuery(
      internal.repo.getRubricByModelAndConcept,
      {
        modelId: swapRubricFrom,
        concept: windowDoc.concept,
      },
    );

    const randomization = resolveRandomizationStrategy(experiment.config);
    const labelMapping = randomization.anonLabel
      ? generateLabelMapping(experiment.config.scaleSize, 0)
      : undefined;
    const sampleId = await step.runMutation(internal.repo.createSample, {
      experimentId: experiment._id,
      modelId: experiment.modelId,
      rubricId: swapRubric._id,
      isSwap: true,
      labelMapping: labelMapping ?? undefined,
      displaySeed: randomization.anonLabel ? 0 : undefined,
    });

    const workItems = evidenceList.map((evidence) => ({
      evidenceId: evidence._id,
      sampleId,
    }));
    const batchSize = 10;

    let scored = 0;
    for (let i = 0; i < workItems.length; i += batchSize) {
      const chunk = workItems.slice(i, i + batchSize);
      await Promise.all(
        chunk.map((item) =>
          step.runAction(
            internal.stages["3_scoring"].scoring_steps.scoreEvidence,
            {
              sampleId: item.sampleId,
              evidenceId: item.evidenceId,
            },
          ),
        ),
      );
      scored += chunk.length;
    }

    return { scored };
  },
});
