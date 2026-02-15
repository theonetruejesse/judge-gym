import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import { internal } from "../../../../../_generated/api";
import { buildScoreCriticPrompt } from "../experiments_scoring_prompts";
import { resolveEvidenceStrategy } from "../../../strategies/experiments_evidence.strategy";
import { providerFor } from "../../../../../platform/utils";

export const enqueueScoreCritics = zInternalMutation({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.object({ enqueued: z.number() }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const evidenceStrategy = resolveEvidenceStrategy(experiment.config);

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) =>
        q.eq("experiment_id", experiment_id),
      )
      .collect();

    let enqueued = 0;
    for (const score of scores) {
      if (score.parse_status !== "parsed") continue;
      const evidence = await ctx.db.get(score.evidence_id);
      const rubric = await ctx.db.get(score.rubric_id);
      if (!evidence || !rubric) continue;

      const evidenceText =
        (evidence as any)[evidenceStrategy.contentField] ?? evidence.raw_content;

      const prompts = buildScoreCriticPrompt({
        evidence: evidenceText,
        rubric: rubric.stages,
        verdict: score.raw_verdict ?? null,
      });

      await ctx.runMutation(
        internal.domain.llm_calls.llm_calls_requests.getOrCreateLlmRequest,
        {
          stage: "score_critic",
          provider: providerFor(score.model_id),
          model: score.model_id,
          system_prompt: prompts.system_prompt,
          user_prompt: prompts.user_prompt,
          experiment_id: score.experiment_id,
          rubric_id: score.rubric_id,
          sample_id: score.sample_id,
          evidence_id: score.evidence_id,
          request_version: 1,
        },
      );
      enqueued += 1;
    }
    return { enqueued };
  },
});
