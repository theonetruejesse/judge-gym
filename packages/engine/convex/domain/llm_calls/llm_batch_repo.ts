import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { LlmBatchesTableSchema } from "../../models/llm_calls";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import type { Doc } from "../../_generated/dataModel";

const CreateLlmBatchArgsSchema = LlmBatchesTableSchema.pick({
  provider: true,
  model: true,
  custom_key: true,
});

export const createLlmBatch = zInternalMutation({
  args: CreateLlmBatchArgsSchema,
  returns: zid("llm_batches"),
  handler: async (ctx, args) => {
    return ctx.db.insert("llm_batches", {
      ...args,
      status: "queued",
    });
  },
});

export const assignRequestsToBatch = zInternalMutation({
  args: z.object({
    request_ids: z.array(zid("llm_requests")),
    batch_id: zid("llm_batches"),
  }),
  handler: async (ctx, args) => {
    for (const requestId of args.request_ids) {
      await ctx.db.patch(requestId, { batch_id: args.batch_id });
    }
  },
});

export type ActiveBatchesResult = {
  queued_batches: Doc<"llm_batches">[];
  running_batches: Doc<"llm_batches">[];
};

export const listActiveBatches = zInternalQuery({
  args: z.object({}),
  handler: async (ctx): Promise<ActiveBatchesResult> => {
    const queued = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    const running = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const finalizing = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", "finalizing"))
      .collect();
    return {
      queued_batches: queued,
      running_batches: running.concat(finalizing),
    };
  },
});

export type BatchWithRequestsResult = {
  batch: Doc<"llm_batches">;
  requests: Doc<"llm_requests">[];
};
export const getBatchWithRequests = zInternalQuery({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, args): Promise<BatchWithRequestsResult> => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) throw new Error("Batch not found");
    const requests = await ctx.db
      .query("llm_requests")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", args.batch_id))
      .collect();
    return { batch, requests };
  },
});

export const patchBatch = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    patch: LlmBatchesTableSchema.partial(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.batch_id, args.patch);
  },
});

export const claimRunningBatchForPoll = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
  }),
  returns: z.object({
    claimed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { claimed: false };
    if (batch.status !== "running" && batch.status !== "finalizing") {
      return { claimed: false };
    }

    const claimOwner = batch.poll_claim_owner ?? null;
    const claimExpiresAt = batch.poll_claim_expires_at ?? null;
    const claimActive = claimOwner !== null
      && claimExpiresAt !== null
      && claimExpiresAt > args.now;

    if (claimActive && claimOwner !== args.owner) {
      return { claimed: false };
    }

    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
    });

    return { claimed: true };
  },
});

export const claimQueuedBatchForSubmit = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
  }),
  returns: z.object({
    claimed: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { claimed: false };
    if (batch.status !== "queued") return { claimed: false };

    const claimOwner = batch.poll_claim_owner ?? null;
    const claimExpiresAt = batch.poll_claim_expires_at ?? null;
    const claimActive = claimOwner !== null
      && claimExpiresAt !== null
      && claimExpiresAt > args.now;

    if (claimActive && claimOwner !== args.owner) {
      return { claimed: false };
    }

    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
    });

    return { claimed: true };
  },
});

export const markBatchFinalizing = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
    now: z.number(),
    lease_ms: z.number().int().min(1),
  }),
  returns: z.object({
    ok: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return { ok: false };
    if (batch.status !== "running" && batch.status !== "finalizing") {
      return { ok: false };
    }
    if (batch.poll_claim_owner !== args.owner) return { ok: false };

    await ctx.db.patch(args.batch_id, {
      status: "finalizing",
      poll_claim_owner: args.owner,
      poll_claim_expires_at: args.now + args.lease_ms,
      next_poll_at: args.now,
    });

    return { ok: true };
  },
});

export const releaseBatchPollClaim = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    owner: z.string(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batch_id);
    if (!batch) return;
    if (batch.poll_claim_owner !== args.owner) return;
    await ctx.db.patch(args.batch_id, {
      poll_claim_owner: null,
      poll_claim_expires_at: null,
    });
  },
});
