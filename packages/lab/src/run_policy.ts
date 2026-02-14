import { PolicyOverridesSchema, type PolicyOverrides } from "@judge-gym/engine";

// Update this file to change scheduling + batching policy defaults.
export const RUN_POLICIES: PolicyOverrides = PolicyOverridesSchema.parse({
  global: {
    poll_interval_ms: 5_000,
    max_batch_size: 500,
    max_new_batches_per_tick: 4,
    max_poll_per_tick: 10,
    max_batch_retries: 2,
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
    ],
  },
});
