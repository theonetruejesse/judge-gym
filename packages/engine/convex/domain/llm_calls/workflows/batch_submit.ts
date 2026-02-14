import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../../platform/utils";
import { batchAdapterRegistry } from "../../../platform/utils/batch_registry";
import { rateLimiter, getRateLimitKeysForModel } from "../../../platform/rate_limiter";
import { internal } from "../../../_generated/api";
import {
  providerSchema,
  DEFAULT_RUN_POLICY,
} from "../../../models/core";
import { policyAllowsModel, resolveRunPolicy } from "../../../utils/policy";
import type { Doc } from "../../../_generated/dataModel";
import type { ActionCtx } from "../../../_generated/server";

async function getPolicyForBatch(ctx: ActionCtx, batch: Doc<"llm_batches">) {
  if (!batch.run_id) return DEFAULT_RUN_POLICY;
  const run = await ctx.runQuery(internal.domain.runs.repo.getRun, {
    run_id: batch.run_id,
  });
  if (!run?.run_config_id) return DEFAULT_RUN_POLICY;
  const runConfig = await ctx.runQuery(internal.domain.configs.repo.getRunConfig, {
    run_config_id: run.run_config_id,
  });
  return resolveRunPolicy({
    policies: runConfig.config_body.policies,
    team_id: runConfig.config_body.team_id,
    provider: batch.provider,
    model: batch.model,
  });
}

async function failBatch(
  ctx: ActionCtx,
  batch: Doc<"llm_batches">,
  items: Doc<"llm_batch_items">[],
  error: string,
) {
  for (const item of items) {
    await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatchItem, {
      batch_item_id: item._id,
      status: "error",
      last_error: error,
    });
    await ctx.runMutation(internal.domain.llm_calls.llm_requests.patchLlmRequest, {
      request_id: item.request_id,
      status: "error",
      last_error: error,
    });
  }
  await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatch, {
    batch_id: batch._id,
    status: "error",
    next_poll_at: undefined,
    locked_until: undefined,
  });
}

export const submitBatch = zInternalAction({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
  }),
  returns: z.object({ submitted: z.number() }),
  handler: async (ctx, { batch_id, provider }) => {
    const batch = (await ctx.runQuery(internal.domain.llm_calls.llm_batches.getBatch, {
      batch_id,
    })) as Doc<"llm_batches">;
    const items = (await ctx.runQuery(internal.domain.llm_calls.llm_batches.listBatchItems, {
      batch_id,
    })) as Doc<"llm_batch_items">[];

    const policy = await getPolicyForBatch(ctx, batch);
    if (!policyAllowsModel(policy, provider, batch.model)) {
      await failBatch(ctx, batch, items, "policy_denied");
      return { submitted: 0 };
    }

    const requests = await Promise.all(
      items.map(async (item) => {
        const req = await ctx.runQuery(internal.domain.llm_calls.llm_requests.getLlmRequest, {
          request_id: item.request_id,
        });
        if (!req.user_prompt) {
          throw new Error(`Missing user_prompt for request ${req._id}`);
        }
        return {
          custom_id: item.custom_id,
          stage: req.stage,
          model: req.model,
          system_prompt: req.system_prompt ?? undefined,
          user_prompt: req.user_prompt,
          temperature: req.temperature ?? undefined,
          top_p: req.top_p ?? undefined,
          seed: req.seed ?? undefined,
          max_tokens: req.max_tokens ?? undefined,
          stop: req.stop ?? undefined,
        };
      }),
    );

    if (requests.length > policy.max_batch_size) {
      await failBatch(ctx, batch, items, "batch_size_exceeded");
      return { submitted: 0 };
    }

    if (requests.length > 0) {
      const keys = getRateLimitKeysForModel(requests[0].model);
      if (keys) {
        await rateLimiter.limit(ctx, keys.requestsKey, {
          count: requests.length,
          throws: true,
        });
      }
    }

    const adapter =
      batchAdapterRegistry[provider as keyof typeof batchAdapterRegistry];
    const result = await adapter.submitBatch(requests);

    const now = Date.now();
    const nextPollDelay = policy.poll_interval_ms;

    await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatch, {
      batch_id: batch._id,
      status: "submitted",
      batch_ref: result.batch_ref,
      completion_window: result.completion_window,
      next_poll_at: now + nextPollDelay,
      locked_until: undefined,
    });

    for (const item of items) {
      await ctx.runMutation(internal.domain.llm_calls.llm_batches.patchBatchItem, {
        batch_item_id: item._id,
        status: "submitted",
      });
    }

    return { submitted: items.length };
  },
});
