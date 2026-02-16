import { MINUTE, type RateLimitConfig } from "@convex-dev/rate-limiter";
import { RunPolicySchema, type RunPolicy } from "./models/core";

type RateTierConfig = {
  configs: Record<string, RateLimitConfig>;
  models: readonly string[];
};

type ProviderRateLimits = {
  tiers: Record<string, RateTierConfig>;
};

export type EngineSettings = {
  run_policy: RunPolicy;
  rate_limits: {
    providers: Record<string, ProviderRateLimits>;
  };
};

const OPENAI_TIERS = {
  FREE: "openai_free",
  TIER_1: "openai_tier_1",
  TIER_2: "openai_tier_2",
  TIER_3: "openai_tier_3",
  TIER_4: "openai_tier_4",
  TIER_5: "openai_tier_5",
} as const;

const ANTHROPIC_TIERS = {
  TIER_1: "anthropic_tier_1",
  TIER_2: "anthropic_tier_2",
  TIER_3: "anthropic_tier_3",
  TIER_4: "anthropic_tier_4",
} as const;

const GOOGLE_TIERS = {
  FREE: "google_free",
  TIER_1: "google_tier_1",
  TIER_2: "google_tier_2",
  TIER_3: "google_tier_3",
} as const;

const XAI_TIERS = {
  STANDARD: "xai_standard",
} as const;

const OPENROUTER_TIERS = {
  FREE: "openrouter_free",
  CREDITS_10_PLUS: "openrouter_credits_10_plus",
  PAID: "openrouter_paid",
} as const;

const OPENAI_RATE_CONFIGS: Record<string, RateTierConfig> = {
  [OPENAI_TIERS.FREE]: { configs: {}, models: [] },
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
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"],
  },
  [OPENAI_TIERS.TIER_2]: {
    configs: {
      "gpt-4.1:requests": {
        kind: "token bucket",
        rate: 5_000,
        period: MINUTE,
        capacity: 5_000,
      },
      "gpt-4.1:input_tokens": {
        kind: "token bucket",
        rate: 450_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 450_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:requests": {
        kind: "token bucket",
        rate: 5_000,
        period: MINUTE,
        capacity: 5_000,
      },
      "gpt-4.1-mini:input_tokens": {
        kind: "token bucket",
        rate: 2_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:output_tokens": {
        kind: "token bucket",
        rate: 2_000_000,
        period: MINUTE,
      },
      "gpt-5.2:requests": {
        kind: "token bucket",
        rate: 5_000,
        period: MINUTE,
        capacity: 5_000,
      },
      "gpt-5.2:input_tokens": {
        kind: "token bucket",
        rate: 1_000_000,
        period: MINUTE,
      },
      "gpt-5.2:output_tokens": {
        kind: "token bucket",
        rate: 1_000_000,
        period: MINUTE,
      },
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"],
  },
  [OPENAI_TIERS.TIER_3]: {
    configs: {
      "gpt-4.1:requests": {
        kind: "token bucket",
        rate: 5_000,
        period: MINUTE,
        capacity: 5_000,
      },
      "gpt-4.1:input_tokens": {
        kind: "token bucket",
        rate: 800_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 800_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:requests": {
        kind: "token bucket",
        rate: 5_000,
        period: MINUTE,
        capacity: 5_000,
      },
      "gpt-4.1-mini:input_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:output_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
      "gpt-5.2:requests": {
        kind: "token bucket",
        rate: 5_000,
        period: MINUTE,
        capacity: 5_000,
      },
      "gpt-5.2:input_tokens": {
        kind: "token bucket",
        rate: 2_000_000,
        period: MINUTE,
      },
      "gpt-5.2:output_tokens": {
        kind: "token bucket",
        rate: 2_000_000,
        period: MINUTE,
      },
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"],
  },
  [OPENAI_TIERS.TIER_4]: {
    configs: {
      "gpt-4.1:requests": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
        capacity: 10_000,
      },
      "gpt-4.1:input_tokens": {
        kind: "token bucket",
        rate: 1_000_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 1_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:requests": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
        capacity: 10_000,
      },
      "gpt-4.1-mini:input_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:output_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
      "gpt-5.2:requests": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
        capacity: 10_000,
      },
      "gpt-5.2:input_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
      "gpt-5.2:output_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"],
  },
  [OPENAI_TIERS.TIER_5]: {
    configs: {
      "gpt-4.1:requests": {
        kind: "token bucket",
        rate: 50_000,
        period: MINUTE,
        capacity: 50_000,
      },
      "gpt-4.1:input_tokens": {
        kind: "token bucket",
        rate: 5_000_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 5_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:requests": {
        kind: "token bucket",
        rate: 50_000,
        period: MINUTE,
        capacity: 50_000,
      },
      "gpt-4.1-mini:input_tokens": {
        kind: "token bucket",
        rate: 10_000_000,
        period: MINUTE,
      },
      "gpt-4.1-mini:output_tokens": {
        kind: "token bucket",
        rate: 10_000_000,
        period: MINUTE,
      },
      "gpt-5.2:requests": {
        kind: "token bucket",
        rate: 50_000,
        period: MINUTE,
        capacity: 50_000,
      },
      "gpt-5.2:input_tokens": {
        kind: "token bucket",
        rate: 10_000_000,
        period: MINUTE,
      },
      "gpt-5.2:output_tokens": {
        kind: "token bucket",
        rate: 10_000_000,
        period: MINUTE,
      },
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"],
  },
};

// Anthropic publishes standard tier limits by model class.
// Sonnet 4.x limits apply across Sonnet 4.x variants, incl. Sonnet 4.5.
const ANTHROPIC_RATE_CONFIGS: Record<string, RateTierConfig> = {
  [ANTHROPIC_TIERS.TIER_1]: {
    configs: {
      "claude-sonnet-4.5:requests": {
        kind: "token bucket",
        rate: 100,
        period: MINUTE,
        capacity: 100,
      },
      "claude-sonnet-4.5:input_tokens": {
        kind: "token bucket",
        rate: 20_000,
        period: MINUTE,
      },
      "claude-sonnet-4.5:output_tokens": {
        kind: "token bucket",
        rate: 4_000,
        period: MINUTE,
      },
      "claude-haiku-4.5:requests": {
        kind: "token bucket",
        rate: 1_000,
        period: MINUTE,
        capacity: 1_000,
      },
      "claude-haiku-4.5:input_tokens": {
        kind: "token bucket",
        rate: 50_000,
        period: MINUTE,
      },
      "claude-haiku-4.5:output_tokens": {
        kind: "token bucket",
        rate: 20_000,
        period: MINUTE,
      },
    },
    models: ["claude-sonnet-4.5", "claude-haiku-4.5"],
  },
  // TODO: Update tiers 2-4 from the Anthropic Limits page in your console.
  [ANTHROPIC_TIERS.TIER_2]: { configs: {}, models: [] },
  [ANTHROPIC_TIERS.TIER_3]: { configs: {}, models: [] },
  [ANTHROPIC_TIERS.TIER_4]: { configs: {}, models: [] },
};

// Google does not publish per-model RPM/TPM limits in docs; view in AI Studio.
// Gemini RPM/TPM limits are shown in Google AI Studio per project and tier.
const GOOGLE_RATE_CONFIGS: Record<string, RateTierConfig> = {
  [GOOGLE_TIERS.FREE]: { configs: {}, models: [] },
  [GOOGLE_TIERS.TIER_1]: {
    configs: {
      "gemini-3.0-flash:requests": {
        kind: "token bucket",
        rate: 60,
        period: MINUTE,
        capacity: 60,
      },
      // TPM limit provided; we mirror it for input/output to keep them non-binding.
      "gemini-3.0-flash:input_tokens": {
        kind: "token bucket",
        rate: 60_000,
        period: MINUTE,
      },
      "gemini-3.0-flash:output_tokens": {
        kind: "token bucket",
        rate: 60_000,
        period: MINUTE,
      },
    },
    models: ["gemini-3.0-flash"],
  },
  [GOOGLE_TIERS.TIER_2]: { configs: {}, models: [] },
  [GOOGLE_TIERS.TIER_3]: { configs: {}, models: [] },
};

// xAI per-model RPM/TPM limits are shown in the xAI Console.
const XAI_RATE_CONFIGS: Record<string, RateTierConfig> = {
  [XAI_TIERS.STANDARD]: {
    configs: {
      "grok-4.1-fast:requests": {
        kind: "token bucket",
        rate: 300,
        period: MINUTE,
        capacity: 300,
      },
      "grok-4.1-fast:input_tokens": {
        kind: "token bucket",
        rate: 100_000,
        period: MINUTE,
      },
      "grok-4.1-fast:output_tokens": {
        kind: "token bucket",
        rate: 100_000,
        period: MINUTE,
      },
    },
    models: ["grok-4.1-fast"],
  },
};

const OPENROUTER_RATE_CONFIGS: Record<string, RateTierConfig> = {
  [OPENROUTER_TIERS.FREE]: {
    configs: {
      "qwen3-235b:requests": {
        kind: "token bucket",
        rate: 20,
        period: MINUTE,
        capacity: 20,
      },
      "qwen3-235b:input_tokens": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
      },
      "qwen3-235b:output_tokens": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
      },
    },
    models: ["qwen3-235b"],
  },
  [OPENROUTER_TIERS.CREDITS_10_PLUS]: {
    configs: {
      "qwen3-235b:requests": {
        kind: "token bucket",
        rate: 60,
        period: MINUTE,
        capacity: 60,
      },
      "qwen3-235b:input_tokens": {
        kind: "token bucket",
        rate: 30_000,
        period: MINUTE,
      },
      "qwen3-235b:output_tokens": {
        kind: "token bucket",
        rate: 30_000,
        period: MINUTE,
      },
    },
    models: ["qwen3-235b"],
  },
  [OPENROUTER_TIERS.PAID]: {
    configs: {
      "qwen3-235b:requests": {
        kind: "token bucket",
        rate: 600,
        period: MINUTE,
        capacity: 600,
      },
      "qwen3-235b:input_tokens": {
        kind: "token bucket",
        rate: 300_000,
        period: MINUTE,
      },
      "qwen3-235b:output_tokens": {
        kind: "token bucket",
        rate: 300_000,
        period: MINUTE,
      },
    },
    models: ["qwen3-235b"],
  },
};

export const ENGINE_SETTINGS: EngineSettings = {
  run_policy: RunPolicySchema.parse({
    poll_interval_ms: 5_000,
    max_batch_size: 500,
    max_new_batches_per_tick: 4,
    max_poll_per_tick: 10,
    max_tokens: 5000,
    max_batch_retries: 2,
    max_request_attempts: 2,
    retry_backoff_ms: 60_000,
    provider_models: [
      {
        provider: "openai",
        models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2", "gpt-5.2-chat"],
      },
      {
        provider: "anthropic",
        models: ["claude-sonnet-4.5", "claude-haiku-4.5"],
      },
      // {
      //   provider: "google",
      //   models: ["gemini-3.0-flash"],
      // }, // TODO: Re-enable when Vertex integration is ready.
    ],
  }),
  rate_limits: {
    providers: {
      openai: { tiers: OPENAI_RATE_CONFIGS },
      anthropic: { tiers: ANTHROPIC_RATE_CONFIGS },
      google: { tiers: GOOGLE_RATE_CONFIGS },
      xai: { tiers: XAI_RATE_CONFIGS },
      openrouter: { tiers: OPENROUTER_RATE_CONFIGS },
    },
  },
};
