import { MINUTE, type RateLimitConfig } from "@convex-dev/rate-limiter";
import type { RateTierConfig } from "./types";

export const OPENAI_TIERS = {
  TIER_1: "openai_tier_1",
  TIER_5: "openai_tier_5",
} as const;

export const OPENAI_RATE_CONFIGS: Record<string, RateTierConfig> = {
  [OPENAI_TIERS.TIER_1]: {
    configs: {
      "gpt-4.1:requests": {
        kind: "token bucket",
        rate: 500,
        period: MINUTE,
        capacity: 500,
      },
      "gpt-4.1:input_tokens": {
        kind: "token bucket",
        rate: 30_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 30_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:requests": {
        kind: "token bucket",
        rate: 500,
        period: MINUTE,
        capacity: 500,
      },
      "gpt-4.1-mini:input_tokens": {
        kind: "token bucket",
        rate: 200_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:output_tokens": {
        kind: "token bucket",
        rate: 200_000,
        period: MINUTE,
      },
      "gpt-5.2:requests": {
        kind: "token bucket",
        rate: 500,
        period: MINUTE,
        capacity: 500,
      },
      "gpt-5.2:input_tokens": {
        kind: "token bucket",
        rate: 500_000,
        period: MINUTE,
      },
      "gpt-5.2:output_tokens": {
        kind: "token bucket",
        rate: 500_000,
        period: MINUTE,
      },
      "gpt-5.2-chat:requests": {
        kind: "token bucket",
        rate: 500,
        period: MINUTE,
        capacity: 500,
      },
      "gpt-5.2-chat:input_tokens": {
        kind: "token bucket",
        rate: 500_000,
        period: MINUTE,
      },
      "gpt-5.2-chat:output_tokens": {
        kind: "token bucket",
        rate: 500_000,
        period: MINUTE,
      },
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2", "gpt-5.2-chat"],
  },
  [OPENAI_TIERS.TIER_5]: {
    configs: {
      "gpt-4.1:requests": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
        capacity: 10_000,
      },
      "gpt-4.1:input_tokens": {
        kind: "token bucket",
        rate: 30_000_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 30_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:requests": {
        kind: "token bucket",
        rate: 30_000,
        period: MINUTE,
        capacity: 30_000,
      },
      "gpt-4.1-mini:input_tokens": {
        kind: "token bucket",
        rate: 150_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:output_tokens": {
        kind: "token bucket",
        rate: 150_000_000,
        period: MINUTE,
      },
      "gpt-5.2:requests": {
        kind: "token bucket",
        rate: 15_000,
        period: MINUTE,
        capacity: 15_000,
      },
      "gpt-5.2:input_tokens": {
        kind: "token bucket",
        rate: 40_000_000,
        period: MINUTE,
      },
      "gpt-5.2:output_tokens": {
        kind: "token bucket",
        rate: 40_000_000,
        period: MINUTE,
      },
      "gpt-5.2-chat:requests": {
        kind: "token bucket",
        rate: 15_000,
        period: MINUTE,
        capacity: 15_000,
      },
      "gpt-5.2-chat:input_tokens": {
        kind: "token bucket",
        rate: 40_000_000,
        period: MINUTE,
      },
      "gpt-5.2-chat:output_tokens": {
        kind: "token bucket",
        rate: 40_000_000,
        period: MINUTE,
      },
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2", "gpt-5.2-chat"],
  },
};

function withBatchKeys(
  configs: Record<string, RateLimitConfig>,
): Record<string, RateLimitConfig> {
  const next = { ...configs };
  for (const [key, value] of Object.entries(configs)) {
    const [model, suffix] = key.split(":");
    if (!model || !suffix) continue;
    if (suffix === "requests" || suffix === "input_tokens" || suffix === "output_tokens") {
      next[`${model}:batch_${suffix}`] = value;
    }
  }
  return next;
}

for (const tier of Object.values(OPENAI_RATE_CONFIGS)) {
  tier.configs = withBatchKeys(tier.configs);
}
