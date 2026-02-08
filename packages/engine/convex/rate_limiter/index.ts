import { RateLimiter, type RateLimitConfig } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import {
  ANTHROPIC_RATE_CONFIGS,
  ANTHROPIC_TIERS,
  GOOGLE_RATE_CONFIGS,
  GOOGLE_TIERS,
  OPENAI_RATE_CONFIGS,
  OPENAI_TIERS,
  OPENROUTER_RATE_CONFIGS,
  OPENROUTER_TIERS,
  XAI_RATE_CONFIGS,
  XAI_TIERS,
} from "./rate_configs";
import type { ModelType } from "../schema";

// change these based on that you actually need to use.
const ACTIVE_PROVIDER_TIERS = {
  openai: OPENAI_TIERS.TIER_5,
  anthropic: ANTHROPIC_TIERS.TIER_1,
  google: GOOGLE_TIERS.TIER_1,
  xai: XAI_TIERS.STANDARD,
  openrouter: OPENROUTER_TIERS.FREE,
} as const;

// Edit these lists to match the models you actually use.
const ACTIVE_MODELS = {
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"] as const,
  anthropic: ["claude-sonnet-4.5", "claude-haiku-4.5"] as const,
  google: ["gemini-3-flash"] as const,
  xai: ["grok-4.1-fast"] as const,
  openrouter: ["qwen3-235b"] as const,
} satisfies Record<ProviderKey, readonly ModelType[]>;


// you shouldn't need to change anything below this point.

type ProviderKey = keyof typeof ACTIVE_PROVIDER_TIERS;

type RateTierConfig = {
  configs: Record<string, RateLimitConfig>;
  models: readonly string[];
};

const PROVIDER_CONFIGS: Record<ProviderKey, Record<string, RateTierConfig>> = {
  openai: OPENAI_RATE_CONFIGS,
  anthropic: ANTHROPIC_RATE_CONFIGS,
  google: GOOGLE_RATE_CONFIGS,
  xai: XAI_RATE_CONFIGS,
  openrouter: OPENROUTER_RATE_CONFIGS,
};

const ACTIVE_TIER_CONFIGS = (Object.keys(
  ACTIVE_PROVIDER_TIERS,
) as ProviderKey[]).map((provider) => {
  const tierKey = ACTIVE_PROVIDER_TIERS[provider];
  return PROVIDER_CONFIGS[provider][tierKey];
});

export const RATE_LIMIT_CONFIGS = Object.assign(
  {},
  ...ACTIVE_TIER_CONFIGS.map((tier) => tier.configs),
) satisfies Record<string, RateLimitConfig>;

export const rateLimiter = new RateLimiter(
  components.rateLimiter,
  RATE_LIMIT_CONFIGS,
);

export const RATE_LIMITED_MODEL_LIST = Object.values(ACTIVE_MODELS).flat() as
  readonly string[];

export type RateLimitedModel = (typeof RATE_LIMITED_MODEL_LIST)[number];

export const RATE_LIMITED_MODELS = new Set<RateLimitedModel>(
  RATE_LIMITED_MODEL_LIST,
);

const REQUIRED_SUFFIXES = [
  "requests",
  "input_tokens",
  "output_tokens",
] as const;

const missingKeys = RATE_LIMITED_MODEL_LIST.flatMap((model) =>
  REQUIRED_SUFFIXES.map((suffix) => `${model}:${suffix}`).filter(
    (key) => !(key in RATE_LIMIT_CONFIGS),
  ),
);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing rate limit configs for: ${missingKeys.join(", ")}. ` +
    "Update rate_configs.ts or adjust ACTIVE_MODELS in rate_limiter/index.ts.",
  );
}

const buildLimitKeyMap = (
  suffix: "requests" | "input_tokens" | "output_tokens",
) =>
  Object.fromEntries(
    RATE_LIMITED_MODEL_LIST.map((model) => [model, `${model}:${suffix}`]),
  ) as Record<RateLimitedModel, string>;

export const REQUEST_LIMIT_KEYS = buildLimitKeyMap("requests");
export const INPUT_TOKEN_LIMIT_KEYS = buildLimitKeyMap("input_tokens");
export const OUTPUT_TOKEN_LIMIT_KEYS = buildLimitKeyMap("output_tokens");
