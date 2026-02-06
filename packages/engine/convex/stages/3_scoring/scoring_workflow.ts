import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { workflow } from "../../workflow_manager";

export const scoringWorkflow = workflow.define({
  args: {
    experimentId: v.string(),
    samples: v.optional(v.number()),
  },
  handler: async (
    step,
    { experimentId, samples },
  ): Promise<{ scored: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentId,
    });
    const evidenceList = await step.runQuery(
      internal.repo.listEvidenceByWindow,
      { windowId: experiment.windowId },
    );
    const rubric = await step.runQuery(internal.repo.getRubricForExperiment, {
      experimentId,
    });
    const n = samples ?? 5;

    let scored = 0;
    for (const evidence of evidenceList) {
      for (let i = 0; i < n; i++) {
        await step.runAction(
          internal.stages["3_scoring"].scoring_steps.scoreEvidence,
          {
            experimentId,
            evidenceId: evidence._id,
            rubricId: rubric._id,
            isSwap: false,
            displaySeed: i,
          },
        );
        scored++;
      }
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentId,
      status: "scoring",
    });

    return { scored };
  },
});

export const swapWorkflow = workflow.define({
  args: {
    experimentId: v.string(),
    swapRubricFrom: v.string(), // modelId of the rubric source
  },
  handler: async (
    step,
    { experimentId, swapRubricFrom },
  ): Promise<{ scored: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentId,
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
        concept: experiment.concept,
      },
    );

    let scored = 0;
    for (const evidence of evidenceList) {
      await step.runAction(
        internal.stages["3_scoring"].scoring_steps.scoreEvidence,
        {
          experimentId,
          evidenceId: evidence._id,
          rubricId: swapRubric._id,
          isSwap: true,
          displaySeed: 0,
        },
      );
      scored++;
    }

    return { scored };
  },
});
