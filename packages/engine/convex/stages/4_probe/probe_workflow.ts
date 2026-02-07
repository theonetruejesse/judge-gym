import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { workflow } from "../../workflow_manager";

export const probeWorkflow = workflow.define({
  args: { experimentTag: v.string() },
  handler: async (step, { experimentTag }): Promise<{ probed: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });
    const scores = await step.runQuery(internal.repo.listNonAbstainedScores, {
      experimentId: experiment._id,
    });

    const batchSize = 10;
    let probed = 0;
    for (let i = 0; i < scores.length; i += batchSize) {
      const chunk = scores.slice(i, i + batchSize);
      await Promise.all(
        chunk.map((score) =>
          step.runAction(
            internal.stages["4_probe"].probe_steps.probeOneSample,
            { scoreId: score._id },
          ),
        ),
      );
      probed += chunk.length;
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentTag,
      status: "complete",
    });

    return { probed };
  },
});
