import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { workflow } from "../../workflow_manager";

export const probeWorkflow = workflow.define({
  args: { experimentId: v.string() },
  handler: async (step, { experimentId }): Promise<{ probed: number }> => {
    const samples = await step.runQuery(internal.repo.listNonAbstainedSamples, {
      experimentId,
    });

    const batchSize = 10;
    let probed = 0;
    for (let i = 0; i < samples.length; i += batchSize) {
      const chunk = samples.slice(i, i + batchSize);
      await Promise.all(
        chunk.map((sample) =>
          step.runAction(
            internal.stages["4_probe"].probe_steps.probeOneSample,
            { sampleId: sample._id },
          ),
        ),
      );
      probed += chunk.length;
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentId,
      status: "complete",
    });

    return { probed };
  },
});
