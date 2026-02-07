import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { workflow } from "../../workflow_manager";

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
    const window = await step.runQuery(internal.repo.getWindow, {
      windowId: experiment.windowId,
    });
    const evidenceList = await step.runQuery(
      internal.repo.listEvidenceByWindow,
      { windowId: experiment.windowId },
    );
    const rubric = await step.runQuery(internal.repo.getRubricForExperiment, {
      experimentId: experiment._id,
    });
    const n = samples ?? 5;

    const workItems = evidenceList.flatMap((evidence) =>
      Array.from({ length: n }, (_, i) => ({
        evidenceId: evidence._id,
        displaySeed: i,
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
              experimentTag,
              evidenceId: item.evidenceId,
              rubricId: rubric._id,
              isSwap: false,
              displaySeed: item.displaySeed,
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

    const workItems = evidenceList.map((evidence) => ({
      evidenceId: evidence._id,
      displaySeed: 0,
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
              experimentTag,
              evidenceId: item.evidenceId,
              rubricId: swapRubric._id,
              isSwap: true,
              displaySeed: item.displaySeed,
            },
          ),
        ),
      );
      scored += chunk.length;
    }

    return { scored };
  },
});
