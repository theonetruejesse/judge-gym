import { RateLimiter, type RateLimitConfig } from "@convex-dev/rate-limiter";
import { components } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";
import { OPENAI_RATE_CONFIGS } from "./provider_tiers";
import {
  rateLimitKeysForModel,
  type RateLimitScope,
} from "../providers/provider_types";
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

export type { RateLimitScope } from "../providers/provider_types";

export function getRateLimitKeysForModel(
  model: string,
  scope: RateLimitScope = "job",
): {
  requestsKey: string;
  inputKey: string;
  outputKey: string;
} | null {
  if (!RATE_LIMITED_MODEL_LIST.includes(model)) {
    return null;
  }
  return rateLimitKeysForModel(model, scope);
}

export const rateLimiter = new RateLimiter(
  components.rateLimiter,
  RATE_LIMIT_CONFIGS,
);
