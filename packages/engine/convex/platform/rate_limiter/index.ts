import { RateLimiter, type RateLimitConfig } from "@convex-dev/rate-limiter";
import { components } from "../../_generated/api";
import { ENGINE_SETTINGS } from "../../settings";

const PROVIDER_CONFIGS = ENGINE_SETTINGS.rate_limits.providers;

export const RATE_LIMIT_CONFIGS = Object.assign(
  {},
  ...Object.values(PROVIDER_CONFIGS).flatMap((provider) =>
    Object.values(provider.tiers).map((tier) => tier.configs),
  ),
) satisfies Record<string, RateLimitConfig>;

export const RATE_LIMITED_MODEL_LIST = Array.from(
  new Set(
    Object.values(PROVIDER_CONFIGS).flatMap((provider) =>
      Object.values(provider.tiers).flatMap((tier) => tier.models),
    ),
  ),
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

export const rateLimiter = new RateLimiter(
  components.rateLimiter,
  RATE_LIMIT_CONFIGS,
);

export function getRateLimitKeysForModel(model: string): {
  requestsKey: string;
  inputKey: string;
  outputKey: string;
} | null {
  const requestsKey = REQUEST_LIMIT_KEYS[model];
  const inputKey = INPUT_TOKEN_LIMIT_KEYS[model];
  const outputKey = OUTPUT_TOKEN_LIMIT_KEYS[model];
  if (!requestsKey || !inputKey || !outputKey) {
    return null;
  }
  return { requestsKey, inputKey, outputKey };
}
