import z from "zod";
import { zAction } from "../../platform/utils";
import { internal } from "../../_generated/api";

export const collectEvidenceForExperiment: ReturnType<typeof zAction> = zAction({
  args: z.object({
    experiment_tag: z.string(),
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    collected: z.number(),
    total: z.number(),
    queued_clean: z.number(),
    queued_neutralize: z.number(),
    queued_abstract: z.number(),
  }),
  handler: async (ctx, { experiment_tag, evidence_limit }) => {
    const experiment = await ctx.runQuery(
      internal.domain.experiments.repo.getExperiment,
      { experiment_tag },
    );

    return ctx.runAction(
      internal.domain.evidence.workflows.collect.collectEvidence,
      { experiment_id: experiment._id, limit: evidence_limit },
    );
  },
});
