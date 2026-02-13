import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../platform/utils";
import {
  LlmRequestStatusSchema,
  LlmStageSchema,
  providerSchema,
  modelTypeSchema,
} from "../../models/core";
import { LlmRequestsTableSchema } from "../../models/llm_calls";

const GetOrCreateArgsSchema = z.object({
  stage: LlmStageSchema,
  provider: providerSchema,
  model: modelTypeSchema,
  system_prompt: z.string().optional(),
  user_prompt: z.string().optional(),
  experiment_id: zid("experiments").nullable(),
  rubric_id: zid("rubrics").nullable(),
  sample_id: zid("samples").nullable(),
  evidence_id: zid("evidences").nullable(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  seed: z.number().optional(),
  max_tokens: z.number().optional(),
  stop: z.array(z.string()).optional(),
  request_version: z.number().optional(),
});

export type GetOrCreateArgs = z.infer<typeof GetOrCreateArgsSchema>;

export const createLlmRequest = zInternalMutation({
  args: LlmRequestsTableSchema,
  handler: async (ctx, args) => ctx.db.insert("llm_requests", args),
});

export const getLlmRequest = zInternalQuery({
  args: z.object({ request_id: zid("llm_requests") }),
  handler: async (ctx, { request_id }) => {
    const req = await ctx.db.get(request_id);
    if (!req) throw new Error("LLM request not found");
    return req;
  },
});

export const listRequestsByStatus = zInternalQuery({
  args: z.object({ status: LlmRequestStatusSchema }),
  handler: async (ctx, { status }) => {
    return ctx.db
      .query("llm_requests")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

export const listRequestsByStageStatus = zInternalQuery({
  args: z.object({ stage: LlmStageSchema, status: LlmRequestStatusSchema }),
  handler: async (ctx, { stage, status }) => {
    return ctx.db
      .query("llm_requests")
      .withIndex("by_stage_status", (q) =>
        q.eq("stage", stage).eq("status", status),
      )
      .collect();
  },
});

export async function getOrCreateLlmRequestImpl(ctx: any, args: GetOrCreateArgs) {
  const requestVersion = args.request_version ?? 1;
  const existing = await ctx.db
    .query("llm_requests")
    .withIndex("by_identity", (q: any) =>
      q
        .eq("stage", args.stage)
        .eq("provider", args.provider)
        .eq("model", args.model)
        .eq("experiment_id", args.experiment_id)
        .eq("rubric_id", args.rubric_id)
        .eq("sample_id", args.sample_id)
        .eq("evidence_id", args.evidence_id)
        .eq("request_version", requestVersion),
    )
    .unique();
  if (existing) {
    if (!existing.user_prompt && args.user_prompt) {
      await ctx.db.patch(existing._id, {
        system_prompt: args.system_prompt,
        user_prompt: args.user_prompt,
      });
    }
    return existing;
  }

  return ctx.db.insert("llm_requests", {
    stage: args.stage,
    provider: args.provider,
    model: args.model,
    system_prompt: args.system_prompt,
    user_prompt: args.user_prompt,
    experiment_id: args.experiment_id,
    rubric_id: args.rubric_id,
    sample_id: args.sample_id,
    evidence_id: args.evidence_id,
    temperature: args.temperature,
    top_p: args.top_p,
    seed: args.seed,
    max_tokens: args.max_tokens,
    stop: args.stop,
    status: "queued",
    attempt: 0,
    request_version: requestVersion,
    last_error: undefined,
    parse_error: undefined,
    result_message_id: undefined,
    batch_item_id: undefined,
    next_retry_at: undefined,
  });
}

export const getOrCreateLlmRequest = zInternalMutation({
  args: GetOrCreateArgsSchema,
  handler: async (ctx, args) => getOrCreateLlmRequestImpl(ctx, args),
});

export const patchLlmRequest = zInternalMutation({
  args: z.object({
    request_id: zid("llm_requests"),
    status: LlmRequestStatusSchema.optional(),
    attempt: z.number().optional(),
    last_error: z.string().optional(),
    parse_error: z.string().optional(),
    result_message_id: zid("llm_messages").optional(),
    batch_item_id: zid("llm_batch_items").optional(),
    next_retry_at: z.number().optional(),
  }),
  handler: async (ctx, { request_id, ...fields }) => {
    await ctx.db.patch(request_id, fields);
  },
});
