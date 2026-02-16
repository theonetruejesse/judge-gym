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
    run_id: zid("runs"),
  }),
  returns: z.object({ rubric_ids: z.array(zid("rubrics")) }),
  handler: async (ctx, { experiment_id, run_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    const run = await ctx.db.get(run_id);
    if (!run || run.experiment_id !== experiment._id) {
      throw new Error("Run not found for experiment");
    }
    const { sample_count } = run.run_counts;

    const window = await ctx.db.get(experiment.window_id);
    if (!window) throw new Error("Window not found");

    const existingRubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_run_model", (q) =>
        q.eq("run_id", run_id).eq("model_id", experiment.config.rubric_stage.model_id),
      )
      .collect();

    const targetCount = sample_count;
    const rubrics: Array<{ _id: Id<"rubrics"> }> = existingRubrics
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime)
      .slice(0, targetCount);

    while (rubrics.length < targetCount) {
      const rubric_id = await ctx.db.insert("rubrics", {
        run_id,
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
          run_id,
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
      internal.domain.runs.workflows.runs_run_state.refreshRunStageCountsForRun,
      { run_id, stage: "rubric_gen" },
    );

    return { rubric_ids: rubrics.map((rubric) => rubric._id) };
  },
});
