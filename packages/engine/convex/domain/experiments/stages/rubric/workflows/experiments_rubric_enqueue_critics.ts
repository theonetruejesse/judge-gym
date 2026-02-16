import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import { internal } from "../../../../../_generated/api";
import { buildRubricCriticPrompt } from "../experiments_rubric_prompts";
import { providerFor } from "../../../../../platform/utils";

export const enqueueRubricCritics = zInternalMutation({
  args: z.object({ run_id: zid("runs") }),
  returns: z.object({ enqueued: z.number() }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.db.get(run_id);
    if (!run) throw new Error("Run not found");
    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();

    let enqueued = 0;
    for (const rubric of rubrics) {
      if (rubric.parse_status !== "parsed") continue;
      const prompts = buildRubricCriticPrompt({
        concept: rubric.concept,
        rubric: { stages: rubric.stages },
      });
      await ctx.runMutation(
        internal.domain.llm_calls.llm_calls_requests.getOrCreateLlmRequest,
        {
          stage: "rubric_critic",
          provider: providerFor(rubric.model_id),
          model: rubric.model_id,
          system_prompt: prompts.system_prompt,
          user_prompt: prompts.user_prompt,
          run_id,
          experiment_id: rubric.experiment_id,
          rubric_id: rubric._id,
          sample_id: null,
          evidence_id: null,
          request_version: 1,
        },
      );
      enqueued += 1;
    }
    if (enqueued > 0) {
      await ctx.db.patch(run_id, {
        current_stage: "rubric_critic",
        updated_at: Date.now(),
      });
    }
    return { enqueued };
  },
});
