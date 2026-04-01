import assert from "assert";
import { describe, it } from "mocha";
import {
  resolveProviderBatchConstraints,
  resolveProviderRateLimit,
  type ProviderExecutionSettings,
} from "@judge-gym/engine-settings/provider";
import {
  buildQuotaBucketRefs,
  estimateTextTokens,
  resolveQuotaBucketPolicy,
} from "../quota";

describe("quota helpers", () => {
  it("builds provider/model/scope bucket refs for active dimensions", () => {
    const refs = buildQuotaBucketRefs({
      provider: "openai",
      model: "gpt-4.1-mini",
      operationType: "chat",
      scopeKey: "run:abc:rubric_gen",
      dimensions: {
        requests: 1,
        input_tokens: 120,
      },
    });

    assert.equal(refs.length, 6);
    assert.equal(refs.filter((ref) => ref.scope === "provider").length, 2);
    assert.equal(refs.filter((ref) => ref.scope === "model").length, 2);
    assert.equal(refs.filter((ref) => ref.scope === "scope").length, 2);
  });

  it("resolves model-level OpenAI quota policy", () => {
    const policy = resolveQuotaBucketPolicy(
      {
        scope: "model",
        dimension: "requests",
        key: "judge-gym:quota:openai:model:gpt-4.1-mini:requests:chat",
      },
      {
        provider: "openai",
        model: "gpt-4.1-mini",
      },
    );

    assert.equal(policy?.capacity, 1_500);
    assert.equal(policy?.rate, 1_500);
  });

  it("ships conservative OpenAI Tier 1 defaults", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_1",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_1",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "openai",
      "gpt-4.1",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 500,
      inputTokensPerMinute: 1_500_000,
      outputTokensPerMinute: 1_500_000,
    });
  });

  it("ships conservative OpenAI Tier 2 defaults", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_2",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_1",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "openai",
      "gpt-4.1",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 1_000,
      inputTokensPerMinute: 3_000_000,
      outputTokensPerMinute: 3_000_000,
    });
  });

  it("ships Anthropic Tier 1 defaults for Claude Sonnet 4", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_5",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_1",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "anthropic",
      "claude-sonnet-4",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 50,
      inputTokensPerMinute: 30_000,
      outputTokensPerMinute: 8_000,
    });
  });

  it("ships Anthropic Tier 2 defaults for Claude Sonnet 4", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_5",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_2",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "anthropic",
      "claude-sonnet-4",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 1_000,
      inputTokensPerMinute: 450_000,
      outputTokensPerMinute: 90_000,
    });
  });

  it("ships Anthropic Tier 3 defaults for Claude Sonnet 4", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_5",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_3",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "anthropic",
      "claude-sonnet-4",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 2_000,
      inputTokensPerMinute: 800_000,
      outputTokensPerMinute: 160_000,
    });
  });

  it("ships Anthropic Tier 4 defaults for Claude Sonnet 4", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_5",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_4",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "anthropic",
      "claude-sonnet-4",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 4_000,
      inputTokensPerMinute: 2_000_000,
      outputTokensPerMinute: 400_000,
    });
  });

  it("lets Anthropic overrides win over bundled tier defaults", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_5",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      anthropic: {
        tier: "tier_1",
        modelRateLimitOverrides: {
          "claude-sonnet-4": {
            requestsPerMinute: 70,
            inputTokensPerMinute: 60_000,
          },
        },
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };
    const rateLimit = resolveProviderRateLimit(
      providerSettings,
      "anthropic",
      "claude-sonnet-4",
    );

    assert.deepEqual(rateLimit, {
      requestsPerMinute: 70,
      inputTokensPerMinute: 60_000,
      outputTokensPerMinute: 8_000,
    });
  });

  it("ships provider-derived batch constraints and allows overrides", () => {
    const providerSettings: ProviderExecutionSettings = {
      openai: {
        tier: "tier_5",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {
          "gpt-4.1": {
            maxEnqueuedInputTokensPerBatch: 2_000_000,
          },
        },
      },
      anthropic: {
        tier: "tier_1",
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
      openrouter: {
        modelRateLimitOverrides: {},
        modelBatchConstraintsOverrides: {},
      },
    };

    assert.deepEqual(
      resolveProviderBatchConstraints(providerSettings, "openai", "gpt-4.1"),
      {
        maxRequestsPerBatch: 50_000,
        maxBatchRequestBytes: 200_000_000,
        maxEnqueuedInputTokensPerBatch: 2_000_000,
      },
    );
    assert.deepEqual(
      resolveProviderBatchConstraints(providerSettings, "anthropic", "claude-sonnet-4"),
      {
        maxRequestsPerBatch: 100_000,
      },
    );
    assert.equal(
      resolveProviderBatchConstraints(providerSettings, "openrouter", "qwen-current-text-flagship"),
      null,
    );
  });

  it("uses a stable text-to-token heuristic", () => {
    assert.equal(estimateTextTokens(""), 0);
    assert.equal(estimateTextTokens("abcd"), 1);
    assert.equal(estimateTextTokens("abcdefgh"), 2);
  });
});
