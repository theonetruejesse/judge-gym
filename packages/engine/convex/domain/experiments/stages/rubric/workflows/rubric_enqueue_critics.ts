import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import { internal } from "../../../../../_generated/api";
import { buildRubricCriticPrompt } from "../rubric_prompts";
import { providerFor } from "../../../../../platform/utils";

export const enqueueRubricCritics = zInternalMutation({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.object({ enqueued: z.number() }),
  handler: async (ctx, { experiment_id }) => {
    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experiment_id", experiment_id),
      )
      .collect();

    let enqueued = 0;
    for (const rubric of rubrics) {
      if (rubric.parse_status !== "parsed") continue;
      const prompts = buildRubricCriticPrompt({
        concept: rubric.concept,
        rubric: { stages: rubric.stages },
      });
      await ctx.runMutation(
        internal.domain.llm_calls.llm_requests.getOrCreateLlmRequest,
        {
          stage: "rubric_critic",
          provider: providerFor(rubric.model_id),
          model: rubric.model_id,
          system_prompt: prompts.system_prompt,
          user_prompt: prompts.user_prompt,
          experiment_id: rubric.experiment_id,
          rubric_id: rubric._id,
          sample_id: null,
          evidence_id: null,
          request_version: 1,
        },
      );
      enqueued += 1;
    }
    return { enqueued };
  },
});
