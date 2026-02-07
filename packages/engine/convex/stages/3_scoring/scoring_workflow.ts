import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { workflow } from "../../workflow_manager";
import { generateLabelMapping } from "../../utils/randomize";

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

    const selectedRubrics = rubrics.slice(0, n);
    const sampleIds = [];
    for (let i = 0; i < selectedRubrics.length; i += 1) {
      const rubric = selectedRubrics[i];
      const labelMapping = experiment.config.randomizeLabels
        ? generateLabelMapping(experiment.config.scaleSize, i)
        : undefined;
      const sampleId = await step.runMutation(internal.repo.createSample, {
        experimentId: experiment._id,
        modelId: experiment.modelId,
        rubricId: rubric._id,
        isSwap: false,
        labelMapping: labelMapping ?? undefined,
        displaySeed: experiment.config.randomizeLabels ? i : undefined,
      });
      sampleIds.push(sampleId);
    }

    const workItems = sampleIds.flatMap((sampleId) =>
      evidenceList.map((evidence) => ({
        sampleId,
        evidenceId: evidence._id,
      })),
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

    const labelMapping = experiment.config.randomizeLabels
      ? generateLabelMapping(experiment.config.scaleSize, 0)
      : undefined;
    const sampleId = await step.runMutation(internal.repo.createSample, {
      experimentId: experiment._id,
      modelId: experiment.modelId,
      rubricId: swapRubric._id,
      isSwap: true,
      labelMapping: labelMapping ?? undefined,
      displaySeed: experiment.config.randomizeLabels ? 0 : undefined,
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
