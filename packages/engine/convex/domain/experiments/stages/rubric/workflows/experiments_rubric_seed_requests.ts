import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import { internal } from "../../../../../_generated/api";
import { buildRubricGenPrompt } from "../experiments_rubric_prompts";
import { providerFor } from "../../../../../platform/utils";
import type { Id } from "../../../../../_generated/dataModel";

export const seedRubricRequests = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    sample_count: z.number().min(1),
  }),
  returns: z.object({ rubric_ids: z.array(zid("rubrics")) }),
  handler: async (ctx, { experiment_id, sample_count }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

    const existingRubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q
          .eq("experiment_id", experiment_id)
          .eq("model_id", experiment.config.rubric_stage.model_id),
      )
      .collect();

    const targetCount = sample_count;
    const rubrics: Array<{ _id: Id<"rubrics"> }> = existingRubrics
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime)
      .slice(0, targetCount);

    while (rubrics.length < targetCount) {
      const rubric_id = await ctx.db.insert("rubrics", {
        experiment_id: experiment._id,
        model_id: experiment.config.rubric_stage.model_id,
        concept: window.concept,
        scale_size: experiment.config.rubric_stage.scale_size,
        stages: [],
        parse_status: "pending",
        attempt_count: 0,
      });
      rubrics.push({ _id: rubric_id });
    }

    const prompts = buildRubricGenPrompt({
      concept: window.concept,
      scale_size: experiment.config.rubric_stage.scale_size,
      config: experiment.config,
    });

    for (const rubric of rubrics) {
      await ctx.runMutation(
        internal.domain.llm_calls.llm_calls_requests.getOrCreateLlmRequest,
        {
          stage: "rubric_gen",
          provider: providerFor(experiment.config.rubric_stage.model_id),
          model: experiment.config.rubric_stage.model_id,
          system_prompt: prompts.system_prompt,
          user_prompt: prompts.user_prompt,
          experiment_id: experiment._id,
          rubric_id: rubric._id,
          sample_id: null,
          evidence_id: null,
          request_version: 1,
          temperature: 0.2,
        },
      );
    }

    await ctx.runMutation(
      internal.domain.runs.workflows.runs_run_state.refreshRunStageCountsForExperiment,
      { experiment_id: experiment._id, stage: "rubric_gen" },
    );

    return { rubric_ids: rubrics.map((rubric) => rubric._id) };
  },
});
