import z from "zod";
import {
  LlmRequestsTableSchema,
} from "../../models/llm_calls";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";
import { Doc } from "../../_generated/dataModel";


const CreateLlmRequestArgsSchema = LlmRequestsTableSchema.pick({
  model: true,
  system_prompt: true,
  user_prompt: true,
  custom_key: true,
  attempts: true,
});

export const createLlmRequest = zInternalMutation({
  args: CreateLlmRequestArgsSchema,
  returns: zid("llm_requests"),
  handler: async (ctx, args) => {
    return ctx.db.insert("llm_requests", {
      ...args,
      job_id: null,
      batch_id: null,
      status: "pending",
      attempts: args.attempts ?? 0,
    });
  },
});

export const getLlmRequest = zInternalQuery({
  args: z.object({ request_id: zid("llm_requests") }),
  handler: async (ctx, args): Promise<Doc<"llm_requests">> => {
    const request = await ctx.db.get(args.request_id);
    if (!request) throw new Error("Request not found");
    return request;
  },
});

export const listOrphanedRequests = zInternalQuery({
  args: z.object({}),
  handler: async (ctx): Promise<Doc<"llm_requests">[]> => {
    return ctx.db
      .query("llm_requests")
      .withIndex("by_orphaned", (q) =>
        q.eq("status", "pending")
          .eq("batch_id", null)
          .eq("job_id", null),
      )
      .collect();
  },
});

export const listRequestsByCustomKey = zInternalQuery({
  args: z.object({ custom_key: z.string() }),
  handler: async (ctx, args): Promise<Doc<"llm_requests">[]> => {
    return ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", args.custom_key))
      .collect();
  },
});

export const listPendingRequestsByCustomKey = zInternalQuery({
  args: z.object({ custom_key: z.string() }),
  handler: async (ctx, args): Promise<Doc<"llm_requests">[]> => {
    return ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", args.custom_key).eq("status", "pending"),
      )
      .collect();
  },
});

export const patchRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    patch: LlmRequestsTableSchema.partial(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.request_id, args.patch);
  },
});
