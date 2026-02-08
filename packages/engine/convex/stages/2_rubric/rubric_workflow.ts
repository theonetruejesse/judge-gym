import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { workflow } from "../../workflow_manager";

export const rubricWorkflow = workflow.define({
  args: { experimentTag: v.string(), samples: v.optional(v.number()) },
  handler: async (
    step,
    { experimentTag, samples },
  ): Promise<{ rubricIds: Id<"rubrics">[] }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });

    const rubricIds: Id<"rubrics">[] = [];
    const count = samples ?? 1;
    const cap = 20;

    if (experiment.taskType === "benchmark") {
      if (count !== 1) {
        throw new Error("Benchmark tasks only support samples=1 for rubrics.");
      }
      const rubricId = await step.runAction(
        internal.stages["2_rubric"].rubric_steps.loadBenchmarkRubric,
        { experimentTag },
      );
      rubricIds.push(rubricId);
    } else {
      // ECC + Control: generate rubric then validate
      for (let i = 0; i < count; i += cap) {
        const batchSize = Math.min(cap, count - i);
        const batch = Array.from({ length: batchSize }, async () => {
          const rubricId = await step.runAction(
            internal.stages["2_rubric"].rubric_steps.generateRubric,
            { experimentTag },
          );

          await step.runAction(
            internal.stages["2_rubric"].rubric_steps.validateRubric,
            { rubricId },
          );
          return rubricId;
        });
        const batchIds = await Promise.all(batch);
        rubricIds.push(...batchIds);
      }
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentTag,
      status: "rubric-done",
    });

    return { rubricIds };
  },
});
