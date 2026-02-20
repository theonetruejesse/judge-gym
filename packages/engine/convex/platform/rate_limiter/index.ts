import { RateLimiter, type RateLimitConfig } from "@convex-dev/rate-limiter";
import { components } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { OPENAI_RATE_CONFIGS } from "./provider_tiers";
import type { ProviderRateLimits, RateTierConfig } from "./types";

const PROVIDER_CONFIGS = ENGINE_SETTINGS.rate_limits.providers;

function resolveProviderTier(
  provider: string,
  config: string | ProviderRateLimits,
): RateTierConfig {
  if (typeof config === "string") {
    if (provider === "openai") {
      return OPENAI_RATE_CONFIGS[config] ?? { configs: {}, models: [] };
    }
    return { configs: {}, models: [] };
  }
  const tier = config.tiers[config.default_tier];
  return tier ?? { configs: {}, models: [] };
}

const ACTIVE_TIER_CONFIGS = Object.entries(PROVIDER_CONFIGS).map(
  ([provider, config]) => resolveProviderTier(provider, config),
);

export const RATE_LIMIT_CONFIGS = Object.assign(
  {},
  ...ACTIVE_TIER_CONFIGS.map((tier) => tier.configs),
) satisfies Record<string, RateLimitConfig>;

export const RATE_LIMITED_MODEL_LIST = Array.from(
  new Set(ACTIVE_TIER_CONFIGS.flatMap((tier) => tier.models)),
) as string[];

export const REQUEST_LIMIT_KEYS = Object.fromEntries(
  RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:requests`]),
) as Record<string, string>;

export const INPUT_TOKEN_LIMIT_KEYS = Object.fromEntries(
  RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:input_tokens`]),
) as Record<string, string>;

export const OUTPUT_TOKEN_LIMIT_KEYS = Object.fromEntries(
  RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:output_tokens`]),
) as Record<string, string>;

export const BATCH_REQUEST_LIMIT_KEYS = Object.fromEntries(
  RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:batch_requests`]),
) as Record<string, string>;

export const BATCH_INPUT_TOKEN_LIMIT_KEYS = Object.fromEntries(
  RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:batch_input_tokens`]),
) as Record<string, string>;

export const BATCH_OUTPUT_TOKEN_LIMIT_KEYS = Object.fromEntries(
  RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:batch_output_tokens`]),
) as Record<string, string>;

export type RateLimitScope = "job" | "batch";

export function getRateLimitKeysForModel(
  model: string,
  scope: RateLimitScope = "job",
): {
  requestsKey: string;
  inputKey: string;
  outputKey: string;
} | null {
  const requestsKey =
    scope === "batch" ? BATCH_REQUEST_LIMIT_KEYS[model] : REQUEST_LIMIT_KEYS[model];
  const inputKey =
    scope === "batch" ? BATCH_INPUT_TOKEN_LIMIT_KEYS[model] : INPUT_TOKEN_LIMIT_KEYS[model];
  const outputKey =
    scope === "batch" ? BATCH_OUTPUT_TOKEN_LIMIT_KEYS[model] : OUTPUT_TOKEN_LIMIT_KEYS[model];
  if (!requestsKey || !inputKey || !outputKey) {
    return null;
  }
  return { requestsKey, inputKey, outputKey };
}

export const rateLimiter = new RateLimiter(
  components.rateLimiter,
  RATE_LIMIT_CONFIGS,
);
