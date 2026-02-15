import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../platform/utils";
import { LlmMessagesTableSchema } from "../../models/llm_calls";

export const createLlmMessage = zInternalMutation({
  args: LlmMessagesTableSchema,
  handler: async (ctx, args) => ctx.db.insert("llm_messages", args),
});

export const getLlmMessage = zInternalQuery({
  args: z.object({ message_id: zid("llm_messages") }),
  handler: async (ctx, { message_id }) => {
    const msg = await ctx.db.get(message_id);
    if (!msg) throw new Error("LLM message not found");
    return msg;
  },
});
