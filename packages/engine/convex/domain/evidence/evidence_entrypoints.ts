import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zQuery } from "../../platform/utils";
import { internal } from "../../_generated/api";
import { preflightCheck } from "../../env";
import { requiredEnvsForEvidenceWindow } from "../../utils/env_requirements";

export const collectEvidence: ReturnType<typeof zAction> = zAction({
  args: z.object({
    window_id: zid("windows"),
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    collected: z.number(),
    total: z.number(),
    queued_clean: z.number(),
    queued_neutralize: z.number(),
    queued_abstract: z.number(),
    evidence_count: z.number(),
  }),
  handler: async (ctx, { window_id, evidence_limit }) => {
    const window = await ctx.runQuery(
      internal.domain.experiments.experiments_repo.getWindow,
      { window_id },
    );
    preflightCheck(requiredEnvsForEvidenceWindow(window));
    const result = await ctx.runAction(
      internal.domain.evidence.workflows.evidence_collect.collectEvidence,
      { window_id, limit: evidence_limit },
    );
    await ctx.runMutation(internal.domain.runs.workflows.runs_scheduler.ensureScheduler, {
      reason: "evidence",
    });
    return result;
  },
});

export const getEvidenceContent: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_id: zid("evidences"),
  }),
  returns: z
    .object({
      evidence_id: zid("evidences"),
      window_id: zid("windows"),
      title: z.string(),
      url: z.string(),
      raw_content: z.string(),
      cleaned_content: z.string().optional(),
      neutralized_content: z.string().optional(),
      abstracted_content: z.string().optional(),
    })
    .nullable(),
  handler: async (ctx, { evidence_id }) => {
    const evidence = await ctx.db.get(evidence_id);
    if (!evidence) return null;
    return {
      evidence_id: evidence._id,
      window_id: evidence.window_id,
      title: evidence.title,
      url: evidence.url,
      raw_content: evidence.raw_content,
      cleaned_content: evidence.cleaned_content,
      neutralized_content: evidence.neutralized_content,
      abstracted_content: evidence.abstracted_content,
    };
  },
});
