import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../platform/utils";
import {
  LlmBatchItemStatusSchema,
  LlmBatchStatusSchema,
} from "../../models/core";
import {
  LlmBatchesTableSchema,
  LlmBatchItemsTableSchema,
} from "../../models/llm_calls";

export const createBatch = zInternalMutation({
  args: LlmBatchesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("llm_batches", args),
});

export const patchBatch = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    status: LlmBatchStatusSchema.optional(),
    batch_ref: z.string().optional(),
    completion_window: z.string().optional(),
    locked_until: z.number().optional(),
    next_poll_at: z.number().optional(),
  }),
  handler: async (ctx, { batch_id, ...fields }) => {
    await ctx.db.patch(batch_id, fields);
  },
});

export const getBatch = zInternalQuery({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, { batch_id }) => {
    const batch = await ctx.db.get(batch_id);
    if (!batch) throw new Error("Batch not found");
    return batch;
  },
});

export const listBatchesByStatus = zInternalQuery({
  args: z.object({ status: LlmBatchStatusSchema }),
  handler: async (ctx, { status }) => {
    return ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

export const listBatchesDueForPolling = zInternalQuery({
  args: z.object({ now: z.number() }),
  handler: async (ctx, { now }) => {
    const batches = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) =>
        q.eq("status", "submitted" as const),
      )
      .collect();

    const running = await ctx.db
      .query("llm_batches")
      .withIndex("by_status", (q) =>
        q.eq("status", "running" as const),
      )
      .collect();

    const all = batches.concat(running);
    return all.filter((batch) => {
      if (batch.locked_until && batch.locked_until > now) return false;
      const next = batch.next_poll_at ?? batch.created_at;
      return next <= now;
    });
  },
});

export const createBatchItem = zInternalMutation({
  args: LlmBatchItemsTableSchema,
  handler: async (ctx, args) => ctx.db.insert("llm_batch_items", args),
});

export const patchBatchItem = zInternalMutation({
  args: z.object({
    batch_item_id: zid("llm_batch_items"),
    status: LlmBatchItemStatusSchema.optional(),
    attempt: z.number().optional(),
    last_error: z.string().optional(),
  }),
  handler: async (ctx, { batch_item_id, ...fields }) => {
    await ctx.db.patch(batch_item_id, fields);
  },
});

export const listBatchItems = zInternalQuery({
  args: z.object({ batch_id: zid("llm_batches") }),
  handler: async (ctx, { batch_id }) => {
    return ctx.db
      .query("llm_batch_items")
      .withIndex("by_batch", (q) => q.eq("batch_id", batch_id))
      .collect();
  },
});
