import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { providerFor } from "./utils";
import { rateLimiter } from "./rate_limiter";

/**
 * Shared usage handler for all agents.
 * Records token consumption to the usage table and feeds
 * actual token counts back to the rate limiter post-hoc.
 */
export const experimentConfig = {
  usageHandler: async (
    ctx: ActionCtx,
    args: {
      agentName: string;
      model: string;
      provider: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      threadId: string;
    },
  ) => {
    // Record usage to DB
    await ctx.runMutation(internal.repo.createUsage, {
      threadId: args.threadId,
      agentName: args.agentName,
      model: args.model,
      provider: args.provider,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
    });

    // Feed token consumption back to rate limiter
    const providerKey = args.provider as ReturnType<typeof providerFor>;
    await rateLimiter.limit(ctx, `${providerKey}:tokens`, {
      count: args.totalTokens,
      throws: false,
    });
  },
};
