import type { RateLimitConfig } from "@convex-dev/rate-limiter";

export type RateTierConfig = {
  configs: Record<string, RateLimitConfig>;
  models: readonly string[];
};

export type ProviderRateLimits = {
  default_tier: string;
  tiers: Record<string, RateTierConfig>;
};

export type EngineRateLimits = {
  providers: {
    openai: string | ProviderRateLimits;
  };
};
