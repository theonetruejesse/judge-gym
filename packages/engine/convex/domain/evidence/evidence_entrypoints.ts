import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zQuery } from "../../platform/utils";
import { internal } from "../../_generated/api";
import { preflightCheck } from "../../env";
import { EVIDENCE_ENV_REQUIREMENTS } from "../../utils/env_requirements";
import type { Id } from "../../_generated/dataModel";

export const collectEvidenceBatch: ReturnType<typeof zAction> = zAction({
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
    evidence_batch_id: zid("evidence_batches"),
    evidence_count: z.number(),
  }),
  handler: async (ctx, { window_id, evidence_limit }) => {
    preflightCheck(EVIDENCE_ENV_REQUIREMENTS);
    const result = await ctx.runAction(
      internal.domain.evidence.workflows.evidence_collect.collectEvidence,
      { window_id, limit: evidence_limit },
    );
    await ctx.runMutation(internal.domain.runs.workflows.scheduler.ensureScheduler, {
      reason: "evidence",
    });
    return result;
  },
});

export const listEvidenceBatches: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    window_id: zid("windows"),
  }),
  returns: z.array(
    z.object({
      evidence_batch_id: zid("evidence_batches"),
      window_id: zid("windows"),
      evidence_limit: z.number(),
      evidence_count: z.number(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, { window_id }) => {
    const batches = await ctx.db
      .query("evidence_batches")
      .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
      .collect();
    return batches
      .slice()
      .sort((a, b) => b.created_at - a.created_at)
      .map((batch) => ({
        evidence_batch_id: batch._id,
        window_id: batch.window_id,
        evidence_limit: batch.evidence_limit,
        evidence_count: batch.evidence_count,
        created_at: batch.created_at,
      }));
  },
});

export const getEvidenceBatch: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_batch_id: zid("evidence_batches"),
  }),
  returns: z
    .object({
      evidence_batch_id: zid("evidence_batches"),
      window_id: zid("windows"),
      evidence_limit: z.number(),
      evidence_count: z.number(),
      created_at: z.number(),
    })
    .nullable(),
  handler: async (ctx, { evidence_batch_id }) => {
    const batch = await ctx.db.get(evidence_batch_id);
    if (!batch) return null;
    return {
      evidence_batch_id: batch._id,
      window_id: batch.window_id,
      evidence_limit: batch.evidence_limit,
      evidence_count: batch.evidence_count,
      created_at: batch.created_at,
    };
  },
});

export const listEvidenceBatchItems: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_batch_id: zid("evidence_batches"),
  }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      position: z.number(),
      title: z.string(),
      url: z.string(),
    }),
  ),
  handler: async (ctx, { evidence_batch_id }) => {
    const items = await ctx.db
      .query("evidence_batch_items")
      .withIndex("by_batch", (q) => q.eq("batch_id", evidence_batch_id))
      .collect();
    const ordered = items.slice().sort((a, b) => a.position - b.position);
    const result: Array<{
      evidence_id: Id<"evidences">;
      position: number;
      title: string;
      url: string;
    }> = [];

    for (const item of ordered) {
      const evidence = await ctx.db.get(item.evidence_id);
      if (!evidence) continue;
      result.push({
        evidence_id: evidence._id,
        position: item.position,
        title: evidence.title,
        url: evidence.url,
      });
    }

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
