import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-provider request rate
  "openai:requests": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "anthropic:requests": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "xai:requests": {
    kind: "token bucket",
    rate: 15,
    period: MINUTE,
    capacity: 5,
  },
  "google:requests": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "openrouter:requests": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },

  // Per-provider token rate — consumed post-hoc in usageHandler
  "openai:tokens": { kind: "token bucket", rate: 100_000, period: MINUTE },
  "anthropic:tokens": { kind: "token bucket", rate: 80_000, period: MINUTE },
  "xai:tokens": { kind: "token bucket", rate: 50_000, period: MINUTE },
  "google:tokens": { kind: "token bucket", rate: 80_000, period: MINUTE },
  "openrouter:tokens": { kind: "token bucket", rate: 60_000, period: MINUTE },

  // Global experiment rate
  "global:requests": { kind: "token bucket", rate: 60, period: MINUTE },
});
