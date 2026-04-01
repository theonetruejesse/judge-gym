import { z } from "zod";
import type { QuotaDimension } from "./quota";
import type { ProviderBatchConstraints } from "./batch";

export const PROVIDERS = {
  openai: {
    id: "openai",
    env_var: "OPENAI_API_KEY",
    batch_mode: "native",
  },
  anthropic: {
    id: "anthropic",
    env_var: "ANTHROPIC_API_KEY",
    batch_mode: "native",
  },
  openrouter: {
    id: "openrouter",
    env_var: "OPENROUTER_API_KEY",
    batch_mode: "none",
  },
} as const;

const PROVIDER_IDS = Object.keys(PROVIDERS) as [
  keyof typeof PROVIDERS,
  ...(keyof typeof PROVIDERS)[],
];

export const providerTypeSchema = z.enum(PROVIDER_IDS);
export type ProviderType = z.infer<typeof providerTypeSchema>;

export type ProviderDefinition = (typeof PROVIDERS)[ProviderType];

export const ProviderBatchModeSchema = z.enum(["native", "none"]);
export type ProviderBatchMode = z.infer<typeof ProviderBatchModeSchema>;

export const ProviderRateLimitSchema = z.object({
  requestsPerMinute: z.number().int().positive().optional(),
  inputTokensPerMinute: z.number().int().positive().optional(),
  outputTokensPerMinute: z.number().int().positive().optional(),
  totalTokensPerMinute: z.number().int().positive().optional(),
  batchEnqueuedInputTokensPerMinute: z.number().int().positive().optional(),
});

export type ProviderRateLimit = z.infer<typeof ProviderRateLimitSchema>;

export const ProviderBatchConstraintsSchema = z.object({
  maxRequestsPerBatch: z.number().int().positive().nullable().optional(),
  maxBatchRequestBytes: z.number().int().positive().nullable().optional(),
  maxEnqueuedInputTokensPerBatch: z.number().int().positive().nullable().optional(),
});

export const MODELS = [
  {
    id: "gpt-4.1",
    provider: "openai",
    provider_model: "gpt-4.1-2025-04-14",
    batchable: true,
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    provider_model: "gpt-4.1-mini-2025-04-14",
    batchable: true,
  },
  {
    id: "gpt-5.2",
    provider: "openai",
    provider_model: "gpt-5.2-2025-12-11",
    batchable: true,
  },
  {
    id: "gpt-5.2-chat",
    provider: "openai",
    provider_model: "gpt-5.2-chat-latest",
    batchable: false,
  },
  {
    id: "claude-sonnet-4",
    provider: "anthropic",
    provider_model: "claude-sonnet-4-20250514",
    batchable: true,
  },
  {
    id: "qwen-current-text-flagship",
    provider: "openrouter",
    // Freeze-time OpenRouter lane for V4 wave 1. Update this provider model
    // when the project formally refreshes the Qwen control line.
    provider_model: "qwen/qwen3-next-80b-a3b-instruct",
    batchable: false,
  },
] as const;

export type ModelDefinition = (typeof MODELS)[number];
export type ModelType = ModelDefinition["id"];
type OpenAiModelType = Extract<ModelDefinition, { provider: "openai" }>["id"];
type AnthropicModelType = Extract<ModelDefinition, { provider: "anthropic" }>["id"];

const MODEL_IDS = MODELS.map((model) => model.id) as [
  ModelType,
  ...ModelType[],
];

export const modelTypeSchema = z.enum(MODEL_IDS);

export const MODEL_BY_ID = Object.fromEntries(
  MODELS.map((model) => [model.id, model]),
) as Record<ModelType, ModelDefinition>;

export function isBatchableModel(model: ModelType): boolean {
  return MODEL_BY_ID[model].batchable;
}

export function getProviderForModel(model: ModelType): ProviderType {
  return MODEL_BY_ID[model].provider;
}

export function getProviderModel(model: ModelType): string {
  return MODEL_BY_ID[model].provider_model;
}

export function getModelConfig(model: ModelType): {
  provider: ProviderType;
  providerModel: string;
  batchable: boolean;
} {
  const definition = MODEL_BY_ID[model];
  return {
    provider: definition.provider,
    providerModel: definition.provider_model,
    batchable: definition.batchable,
  };
}

export function getProviderEnv(provider: ProviderType): string {
  return PROVIDERS[provider].env_var;
}

export function getProviderBatchMode(provider: ProviderType): ProviderBatchMode {
  return PROVIDERS[provider].batch_mode;
}

export function providerSupportsBatching(provider: ProviderType): boolean {
  return getProviderBatchMode(provider) === "native";
}

export const OpenAiTierSchema = z.enum(["tier_2", "tier_5"]);
export type OpenAiTier = z.infer<typeof OpenAiTierSchema>;
export const AnthropicTierSchema = z.enum([
  "tier_1",
  "tier_2",
  "tier_3",
  "tier_4",
  "custom",
]);
export type AnthropicTier = z.infer<typeof AnthropicTierSchema>;

function isOpenAiModel(model: ModelType): model is OpenAiModelType {
  return MODEL_BY_ID[model].provider === "openai";
}

function isAnthropicModel(model: ModelType): model is AnthropicModelType {
  return MODEL_BY_ID[model].provider === "anthropic";
}

// OpenAI's public docs expose the usage tier ladder, but model-specific rate
// limits are resolved from the org limits page rather than a stable public
// table. These tier_2 defaults are intentionally conservative and can be
// overridden per model when the project wants to mirror dashboard ceilings
// exactly.
const OPENAI_TIER_2_MODEL_LIMITS: Record<OpenAiModelType, ProviderRateLimit> = {
  "gpt-4.1": {
    requestsPerMinute: 1_000,
    inputTokensPerMinute: 3_000_000,
    outputTokensPerMinute: 3_000_000,
  },
  "gpt-4.1-mini": {
    requestsPerMinute: 3_000,
    inputTokensPerMinute: 15_000_000,
    outputTokensPerMinute: 15_000_000,
  },
  "gpt-5.2": {
    requestsPerMinute: 1_500,
    inputTokensPerMinute: 4_000_000,
    outputTokensPerMinute: 4_000_000,
  },
  "gpt-5.2-chat": {
    requestsPerMinute: 1_500,
    inputTokensPerMinute: 4_000_000,
    outputTokensPerMinute: 4_000_000,
  },
};

const OPENAI_TIER_5_MODEL_LIMITS: Record<OpenAiModelType, ProviderRateLimit> = {
  "gpt-4.1": {
    requestsPerMinute: 10_000,
    inputTokensPerMinute: 30_000_000,
    outputTokensPerMinute: 30_000_000,
  },
  "gpt-4.1-mini": {
    requestsPerMinute: 30_000,
    inputTokensPerMinute: 150_000_000,
    outputTokensPerMinute: 150_000_000,
  },
  "gpt-5.2": {
    requestsPerMinute: 15_000,
    inputTokensPerMinute: 40_000_000,
    outputTokensPerMinute: 40_000_000,
  },
  "gpt-5.2-chat": {
    requestsPerMinute: 15_000,
    inputTokensPerMinute: 40_000_000,
    outputTokensPerMinute: 40_000_000,
  },
};

const OPENAI_TIER_LIMITS: Record<
  OpenAiTier,
  Record<OpenAiModelType, ProviderRateLimit>
> = {
  tier_2: OPENAI_TIER_2_MODEL_LIMITS,
  tier_5: OPENAI_TIER_5_MODEL_LIMITS,
};

// Anthropic publishes standard Sonnet 4.x limits by usage tier.
const ANTHROPIC_TIER_1_MODEL_LIMITS: Record<AnthropicModelType, ProviderRateLimit> = {
  "claude-sonnet-4": {
    requestsPerMinute: 50,
    inputTokensPerMinute: 30_000,
    outputTokensPerMinute: 8_000,
  },
};

const ANTHROPIC_TIER_2_MODEL_LIMITS: Record<AnthropicModelType, ProviderRateLimit> = {
  "claude-sonnet-4": {
    requestsPerMinute: 1_000,
    inputTokensPerMinute: 450_000,
    outputTokensPerMinute: 90_000,
  },
};

const ANTHROPIC_TIER_3_MODEL_LIMITS: Record<AnthropicModelType, ProviderRateLimit> = {
  "claude-sonnet-4": {
    requestsPerMinute: 2_000,
    inputTokensPerMinute: 800_000,
    outputTokensPerMinute: 160_000,
  },
};

const ANTHROPIC_TIER_4_MODEL_LIMITS: Record<AnthropicModelType, ProviderRateLimit> = {
  "claude-sonnet-4": {
    requestsPerMinute: 4_000,
    inputTokensPerMinute: 2_000_000,
    outputTokensPerMinute: 400_000,
  },
};

const ANTHROPIC_TIER_LIMITS: Partial<
  Record<AnthropicTier, Partial<Record<AnthropicModelType, ProviderRateLimit>>>
> = {
  tier_1: ANTHROPIC_TIER_1_MODEL_LIMITS,
  tier_2: ANTHROPIC_TIER_2_MODEL_LIMITS,
  tier_3: ANTHROPIC_TIER_3_MODEL_LIMITS,
  tier_4: ANTHROPIC_TIER_4_MODEL_LIMITS,
};

export const OpenAiProviderSettingsSchema = z.object({
  tier: OpenAiTierSchema.default("tier_2"),
  modelRateLimitOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderRateLimitSchema,
  ).default({}),
  modelBatchConstraintsOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderBatchConstraintsSchema,
  ).default({}),
});

export type OpenAiProviderSettings = z.infer<typeof OpenAiProviderSettingsSchema>;

export const AnthropicProviderSettingsSchema = z.object({
  tier: AnthropicTierSchema.default("tier_1"),
  modelRateLimitOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderRateLimitSchema,
  ).default({}),
  modelBatchConstraintsOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderBatchConstraintsSchema,
  ).default({}),
});

export type AnthropicProviderSettings = z.infer<typeof AnthropicProviderSettingsSchema>;

export const OpenRouterProviderSettingsSchema = z.object({
  modelRateLimitOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderRateLimitSchema,
  ).default({}),
  modelBatchConstraintsOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderBatchConstraintsSchema,
  ).default({}),
});

export type OpenRouterProviderSettings = z.infer<typeof OpenRouterProviderSettingsSchema>;

export const ProviderExecutionSettingsSchema = z.object({
  openai: OpenAiProviderSettingsSchema.default({
    tier: "tier_2",
    modelRateLimitOverrides: {},
    modelBatchConstraintsOverrides: {},
  }),
  anthropic: AnthropicProviderSettingsSchema.default({
    tier: "tier_1",
    modelRateLimitOverrides: {},
    modelBatchConstraintsOverrides: {},
  }),
  openrouter: OpenRouterProviderSettingsSchema.default({
    modelRateLimitOverrides: {},
    modelBatchConstraintsOverrides: {},
  }),
});

export type ProviderExecutionSettings =
  z.infer<typeof ProviderExecutionSettingsSchema>;

export const DEFAULT_PROVIDER_EXECUTION_SETTINGS: ProviderExecutionSettings =
  ProviderExecutionSettingsSchema.parse({});

type TokenBucketPolicy = {
  rate: number;
  periodMs: number;
  capacity: number;
};

const MINUTE_MS = 60_000;

const OPENAI_DEFAULT_BATCH_CONSTRAINTS: ProviderBatchConstraints = {
  maxRequestsPerBatch: 50_000,
  maxBatchRequestBytes: 200_000_000,
};

const ANTHROPIC_DEFAULT_BATCH_CONSTRAINTS: ProviderBatchConstraints = {
  maxRequestsPerBatch: 100_000,
};

export function resolveProviderRateLimit(
  providerSettings: ProviderExecutionSettings,
  provider: ProviderType,
  model: ModelType,
): ProviderRateLimit | null {
  switch (provider) {
    case "openai": {
      if (!isOpenAiModel(model)) {
        return null;
      }
      const tierLimits = OPENAI_TIER_LIMITS[providerSettings.openai.tier][model];
      const override = providerSettings.openai.modelRateLimitOverrides[model];
      return {
        ...tierLimits,
        ...(override ?? {}),
      };
    }
    case "anthropic":
      if (!isAnthropicModel(model)) {
        return null;
      }
      return {
        ...(ANTHROPIC_TIER_LIMITS[providerSettings.anthropic.tier]?.[model] ?? {}),
        ...(providerSettings.anthropic.modelRateLimitOverrides[model] ?? {}),
      };
    case "openrouter":
      return providerSettings.openrouter.modelRateLimitOverrides[model] ?? null;
  }
}

export function resolveProviderBatchConstraints(
  providerSettings: ProviderExecutionSettings,
  provider: ProviderType,
  model: ModelType,
): ProviderBatchConstraints | null {
  switch (provider) {
    case "openai":
      if (!isOpenAiModel(model)) {
        return null;
      }
      return {
        ...OPENAI_DEFAULT_BATCH_CONSTRAINTS,
        ...(providerSettings.openai.modelBatchConstraintsOverrides[model] ?? {}),
      };
    case "anthropic":
      if (!isAnthropicModel(model)) {
        return null;
      }
      return {
        ...ANTHROPIC_DEFAULT_BATCH_CONSTRAINTS,
        ...(providerSettings.anthropic.modelBatchConstraintsOverrides[model] ?? {}),
      };
    case "openrouter":
      return providerSettings.openrouter.modelBatchConstraintsOverrides[model] ?? null;
  }
}

export function rateLimitToTokenBucketPolicies(
  rateLimit: ProviderRateLimit | null | undefined,
): Partial<Record<QuotaDimension, TokenBucketPolicy>> {
  if (!rateLimit) {
    return {};
  }

  return {
    ...(rateLimit.requestsPerMinute
      ? {
          requests: {
            rate: rateLimit.requestsPerMinute,
            periodMs: MINUTE_MS,
            capacity: rateLimit.requestsPerMinute,
          },
        }
      : {}),
    ...(rateLimit.inputTokensPerMinute
      ? {
          input_tokens: {
            rate: rateLimit.inputTokensPerMinute,
            periodMs: MINUTE_MS,
            capacity: rateLimit.inputTokensPerMinute,
          },
        }
      : {}),
    ...(rateLimit.outputTokensPerMinute
      ? {
          output_tokens: {
            rate: rateLimit.outputTokensPerMinute,
            periodMs: MINUTE_MS,
            capacity: rateLimit.outputTokensPerMinute,
          },
        }
      : {}),
    ...(rateLimit.totalTokensPerMinute
      ? {
          total_tokens: {
            rate: rateLimit.totalTokensPerMinute,
            periodMs: MINUTE_MS,
            capacity: rateLimit.totalTokensPerMinute,
          },
        }
      : {}),
    ...(rateLimit.batchEnqueuedInputTokensPerMinute
      ? {
          batch_enqueued_input_tokens: {
            rate: rateLimit.batchEnqueuedInputTokensPerMinute,
            periodMs: MINUTE_MS,
            capacity: rateLimit.batchEnqueuedInputTokensPerMinute,
          },
        }
      : {}),
  };
}
