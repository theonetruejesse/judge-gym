import { internal } from "./_generated/api";
import type { UsageHandler } from "@convex-dev/agent";
import {
  rateLimiter,
  RATE_LIMITED_MODELS,
  INPUT_TOKEN_LIMIT_KEYS,
  OUTPUT_TOKEN_LIMIT_KEYS,
  type RateLimitedModel,
} from "./rate_limiter";

/**
 * Shared usage handler for all agents.
 * Records token consumption to the usage table and feeds
 * actual token counts back to the rate limiter post-hoc.
 */
export const experimentConfig = {
  usageHandler: (async (ctx, args) => {
    // Record usage to DB
    await ctx.runMutation(internal.repo.createUsage, {
      threadId: args.threadId ?? "",
      agentName: args.agentName ?? "",
      model: args.model,
      provider: args.provider,
      promptTokens: args.usage.inputTokens ?? 0,
      completionTokens: args.usage.outputTokens ?? 0,
      totalTokens: args.usage.totalTokens ?? 0,
    });

    // Feed token consumption back to rate limiter
    if (RATE_LIMITED_MODELS.has(args.model as RateLimitedModel)) {
      const model = args.model as RateLimitedModel;
      const inputKey = INPUT_TOKEN_LIMIT_KEYS[model];
      const outputKey = OUTPUT_TOKEN_LIMIT_KEYS[model];
      await rateLimiter.limit(ctx, inputKey, {
        count: args.usage.inputTokens ?? 0,
        throws: false,
      });
      await rateLimiter.limit(ctx, outputKey, {
        count: args.usage.outputTokens ?? 0,
        throws: false,
      });
    }
  }) satisfies UsageHandler,
};
