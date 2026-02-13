import { MINUTE, type RateLimitConfig } from "@convex-dev/rate-limiter";

// adjust this file to match the actual tiers and models you are using.

export const OPENAI_TIERS = {
  FREE: "openai_free",
  TIER_1: "openai_tier_1",
  TIER_2: "openai_tier_2",
  TIER_3: "openai_tier_3",
  TIER_4: "openai_tier_4",
  TIER_5: "openai_tier_5",
} as const;

export const ANTHROPIC_TIERS = {
  TIER_1: "anthropic_tier_1",
  TIER_2: "anthropic_tier_2",
  TIER_3: "anthropic_tier_3",
  TIER_4: "anthropic_tier_4",
} as const;

export const GOOGLE_TIERS = {
  FREE: "google_free",
  TIER_1: "google_tier_1",
  TIER_2: "google_tier_2",
  TIER_3: "google_tier_3",
} as const;

export const XAI_TIERS = {
  STANDARD: "xai_standard",
} as const;

export const OPENROUTER_TIERS = {
  FREE: "openrouter_free",
  CREDITS_10_PLUS: "openrouter_credits_10_plus",
  PAID: "openrouter_paid",
} as const;

type RateTierConfig = {
  configs: Record<string, RateLimitConfig>;
  models: readonly string[];
};


export const OPENAI_RATE_CONFIGS = {
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
        rate: 2_000_000,
        period: MINUTE,
      },
      "gpt-4.1:output_tokens": {
        kind: "token bucket",
        rate: 2_000_000,
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
    },
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5.2"],
  },
} satisfies Record<string, RateTierConfig>;

// Anthropic publishes standard tier limits by model class.
export const ANTHROPIC_RATE_CONFIGS = {
  [ANTHROPIC_TIERS.TIER_1]: {
    configs: {
      // Sonnet 4.x limits apply across Sonnet 4.x variants, incl. Sonnet 4.5.
      "claude-sonnet-4.5:requests": {
        kind: "token bucket",
        rate: 50,
        period: MINUTE,
        capacity: 50,
      },
      "claude-sonnet-4.5:input_tokens": {
        kind: "token bucket",
        rate: 30_000,
        period: MINUTE,
      },
      "claude-sonnet-4.5:output_tokens": {
        kind: "token bucket",
        rate: 8_000,
        period: MINUTE,
      },
      "claude-haiku-4.5:requests": {
        kind: "token bucket",
        rate: 50,
        period: MINUTE,
        capacity: 50,
      },
      "claude-haiku-4.5:input_tokens": {
        kind: "token bucket",
        rate: 50_000,
        period: MINUTE,
      },
      "claude-haiku-4.5:output_tokens": {
        kind: "token bucket",
        rate: 10_000,
        period: MINUTE,
      },
    },
    models: ["claude-sonnet-4.5", "claude-haiku-4.5"],
  },
  // TODO: Update tiers 2-4 from the Anthropic Limits page in your console.
  [ANTHROPIC_TIERS.TIER_2]: { configs: {}, models: [] },
  [ANTHROPIC_TIERS.TIER_3]: { configs: {}, models: [] },
  [ANTHROPIC_TIERS.TIER_4]: { configs: {}, models: [] },
} satisfies Record<string, RateTierConfig>;

// Google does not publish per-model RPM/TPM limits in docs; view in AI Studio.
// Gemini RPM/TPM limits are shown in Google AI Studio per project and tier.
export const GOOGLE_RATE_CONFIGS = {
  [GOOGLE_TIERS.FREE]: { configs: {}, models: [] },
  [GOOGLE_TIERS.TIER_1]: {
    configs: {
      "gemini-3.0-flash:requests": {
        kind: "token bucket",
        rate: 1_000,
        period: MINUTE,
        capacity: 1_000,
      },
      // TPM limit provided; we mirror it for input/output to keep them non-binding.
      "gemini-3.0-flash:input_tokens": {
        kind: "token bucket",
        rate: 1_000_000,
        period: MINUTE,
      },
      "gemini-3.0-flash:output_tokens": {
        kind: "token bucket",
        rate: 1_000_000,
        period: MINUTE,
      },
    },
    models: ["gemini-3.0-flash"],
  },
  [GOOGLE_TIERS.TIER_2]: { configs: {}, models: [] },
  [GOOGLE_TIERS.TIER_3]: { configs: {}, models: [] },
} satisfies Record<string, RateTierConfig>;

// xAI per-model RPM/TPM limits are shown in the xAI Console.
export const XAI_RATE_CONFIGS = {
  [XAI_TIERS.STANDARD]: {
    configs: {
      "grok-4.1-fast:requests": {
        kind: "token bucket",
        rate: 480,
        period: MINUTE,
        capacity: 480,
      },
      "grok-4.1-fast:input_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
      "grok-4.1-fast:output_tokens": {
        kind: "token bucket",
        rate: 4_000_000,
        period: MINUTE,
      },
    },
    models: ["grok-4.1-fast"],
  },
} satisfies Record<string, RateTierConfig>;

const OPENROUTER_TPM_UNLIMITED = 1_000_000_000;
const OPENROUTER_RPM_UNLIMITED = 1_000_000_000;

export const OPENROUTER_RATE_CONFIGS = {
  [OPENROUTER_TIERS.FREE]: {
    configs: {
      "openrouter-free:requests": {
        kind: "token bucket",
        rate: 20,
        period: MINUTE,
        capacity: 20,
      },
      "openrouter-free:input_tokens": {
        kind: "token bucket",
        rate: OPENROUTER_TPM_UNLIMITED,
        period: MINUTE,
      },
      "openrouter-free:output_tokens": {
        kind: "token bucket",
        rate: OPENROUTER_TPM_UNLIMITED,
        period: MINUTE,
      },
    },
    models: ["openrouter-free"],
  },
  [OPENROUTER_TIERS.CREDITS_10_PLUS]: {
    configs: {
      "openrouter-credits-10-plus:requests": {
        kind: "token bucket",
        rate: 20,
        period: MINUTE,
        capacity: 20,
      },
      "openrouter-credits-10-plus:input_tokens": {
        kind: "token bucket",
        rate: OPENROUTER_TPM_UNLIMITED,
        period: MINUTE,
      },
      "openrouter-credits-10-plus:output_tokens": {
        kind: "token bucket",
        rate: OPENROUTER_TPM_UNLIMITED,
        period: MINUTE,
      },
    },
    models: ["openrouter-credits-10-plus"],
  },
  [OPENROUTER_TIERS.PAID]: {
    configs: {
      // OpenRouter doesn't enforce RPM/TPM for paid-model usage; providers may still throttle.
      "qwen3-235b:requests": {
        kind: "token bucket",
        rate: OPENROUTER_RPM_UNLIMITED,
        period: MINUTE,
        capacity: OPENROUTER_RPM_UNLIMITED,
      },
      "qwen3-235b:input_tokens": {
        kind: "token bucket",
        rate: OPENROUTER_TPM_UNLIMITED,
        period: MINUTE,
      },
      "qwen3-235b:output_tokens": {
        kind: "token bucket",
        rate: OPENROUTER_TPM_UNLIMITED,
        period: MINUTE,
      },
    },
    models: ["qwen3-235b"],
  },
} satisfies Record<string, RateTierConfig>;
