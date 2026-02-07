import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { workflow } from "../../workflow_manager";

export const rubricWorkflow = workflow.define({
  args: { experimentTag: v.string() },
  handler: async (
    step,
    { experimentTag },
  ): Promise<{ rubricId: Id<"rubrics"> }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });

    let rubricId: Id<"rubrics">;

    if (experiment.taskType === "benchmark") {
      rubricId = await step.runAction(
        internal.stages["2_rubric"].rubric_steps.loadBenchmarkRubric,
        { experimentTag },
      );
    } else {
      // ECC + Control: generate rubric then validate
      rubricId = await step.runAction(
        internal.stages["2_rubric"].rubric_steps.generateRubric,
        { experimentTag },
      );

      await step.runAction(
        internal.stages["2_rubric"].rubric_steps.validateRubric,
        { rubricId },
      );
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentTag,
      status: "rubric-done",
    });

    return { rubricId };
  },
});
