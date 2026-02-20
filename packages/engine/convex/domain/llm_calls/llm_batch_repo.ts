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
    return {
      queued_batches: queued,
      running_batches: running,
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
