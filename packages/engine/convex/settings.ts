import type { RunPolicy } from "./platform/run_policy";
import { OPENAI_TIERS } from "./platform/rate_limiter/provider_tiers";
import type { EngineRateLimits } from "./platform/rate_limiter/types";

export type EngineSettings = {
  run_policy: RunPolicy;
  rate_limits: EngineRateLimits;
};

export const ENGINE_SETTINGS: EngineSettings = {
  run_policy: {
    poll_interval_ms: 20_000,
    max_batch_size: 100,
    min_batch_size: 25,
    max_tokens: 8_000,
    max_batch_retries: 2,
    max_request_attempts: 3,
    retry_backoff_ms: 60_000,
    job_request_concurrency: 8,
  },
  rate_limits: {
    providers: {
      openai: OPENAI_TIERS.TIER_5,
    },
  },
};
