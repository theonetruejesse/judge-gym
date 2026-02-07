import {
  RateLimiter,
  MINUTE,
  type RateLimitConfig,
} from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const RATE_LIMIT_CONFIGS = {
  // ── OpenAI Tier 1 (commented out — high tier, no practical limit) ────
  // Uncomment and add to RATE_LIMITED_MODELS for your tier.
  // TPM is combined input+output.
  // "gpt-4.1:requests":           { kind: "token bucket", rate: 500, period: MINUTE, capacity: 50 },
  // "gpt-4.1:input_tokens":       { kind: "token bucket", rate: 30_000, period: MINUTE },
  // "gpt-4.1:output_tokens":      { kind: "token bucket", rate: 30_000, period: MINUTE },
  // "gpt-4.1-mini:requests":      { kind: "token bucket", rate: 500, period: MINUTE, capacity: 50 },
  // "gpt-4.1-mini:input_tokens":  { kind: "token bucket", rate: 200_000, period: MINUTE },
  // "gpt-4.1-mini:output_tokens": { kind: "token bucket", rate: 200_000, period: MINUTE },
  // "gpt-5.2:requests":           { kind: "token bucket", rate: 500, period: MINUTE, capacity: 50 },
  // "gpt-5.2:input_tokens":       { kind: "token bucket", rate: 500_000, period: MINUTE },
  // "gpt-5.2:output_tokens":      { kind: "token bucket", rate: 500_000, period: MINUTE },

  // ── Anthropic Tier 1 (active — binding constraint) ───────────────────
  "claude-sonnet-4.5:requests": {
    kind: "token bucket",
    rate: 50,
    period: MINUTE,
    capacity: 10,
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
    capacity: 10,
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

  // ── Google (commented out — generous limits) ─────────────────────────
  // "gemini-3-flash:requests":      { kind: "token bucket", rate: 60, period: MINUTE, capacity: 15 },
  // "gemini-3-flash:input_tokens":  { kind: "token bucket", rate: 250_000, period: MINUTE },
  // "gemini-3-flash:output_tokens": { kind: "token bucket", rate: 250_000, period: MINUTE },

  // ── xAI (commented out — 480 RPM, 4M TPM) ───────────────────────────
  // "grok-4.1-fast:requests":      { kind: "token bucket", rate: 480, period: MINUTE, capacity: 50 },
  // "grok-4.1-fast:input_tokens":  { kind: "token bucket", rate: 4_000_000, period: MINUTE },
  // "grok-4.1-fast:output_tokens": { kind: "token bucket", rate: 4_000_000, period: MINUTE },

  // ── OpenRouter (commented out — 20 RPM for free tier) ────────────────
  // "qwen3-235b:requests":      { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },
  // "qwen3-235b:input_tokens":  { kind: "token bucket", rate: 60_000, period: MINUTE },
  // "qwen3-235b:output_tokens": { kind: "token bucket", rate: 60_000, period: MINUTE },
} satisfies Record<string, RateLimitConfig>;

export const rateLimiter = new RateLimiter(
  components.rateLimiter,
  RATE_LIMIT_CONFIGS,
);

/** Models with active rate limit buckets. Add/remove as you uncomment configs above. */
export const RATE_LIMITED_MODEL_LIST = [
  "claude-sonnet-4.5",
  "claude-haiku-4.5",
] as const;

export type RateLimitedModel = (typeof RATE_LIMITED_MODEL_LIST)[number];

export const RATE_LIMITED_MODELS = new Set<RateLimitedModel>(
  RATE_LIMITED_MODEL_LIST,
);

export const REQUEST_LIMIT_KEYS: Record<
  RateLimitedModel,
  keyof typeof RATE_LIMIT_CONFIGS
> = {
  "claude-sonnet-4.5": "claude-sonnet-4.5:requests",
  "claude-haiku-4.5": "claude-haiku-4.5:requests",
};

export const INPUT_TOKEN_LIMIT_KEYS: Record<
  RateLimitedModel,
  keyof typeof RATE_LIMIT_CONFIGS
> = {
  "claude-sonnet-4.5": "claude-sonnet-4.5:input_tokens",
  "claude-haiku-4.5": "claude-haiku-4.5:input_tokens",
};

export const OUTPUT_TOKEN_LIMIT_KEYS: Record<
  RateLimitedModel,
  keyof typeof RATE_LIMIT_CONFIGS
> = {
  "claude-sonnet-4.5": "claude-sonnet-4.5:output_tokens",
  "claude-haiku-4.5": "claude-haiku-4.5:output_tokens",
};
