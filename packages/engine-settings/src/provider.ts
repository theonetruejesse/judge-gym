import { z } from "zod";
import type { QuotaDimension } from "./quota";

export const PROVIDERS = {
  openai: {
    id: "openai",
    env_var: "OPENAI_API_KEY",
  },
} as const;

const PROVIDER_IDS = Object.keys(PROVIDERS) as [
  keyof typeof PROVIDERS,
  ...(keyof typeof PROVIDERS)[],
];

export const providerTypeSchema = z.enum(PROVIDER_IDS);
export type ProviderType = z.infer<typeof providerTypeSchema>;

export type ProviderDefinition = (typeof PROVIDERS)[ProviderType];

export const ProviderRateLimitSchema = z.object({
  requestsPerMinute: z.number().int().positive().optional(),
  inputTokensPerMinute: z.number().int().positive().optional(),
  outputTokensPerMinute: z.number().int().positive().optional(),
  totalTokensPerMinute: z.number().int().positive().optional(),
  batchEnqueuedInputTokensPerMinute: z.number().int().positive().optional(),
});

export type ProviderRateLimit = z.infer<typeof ProviderRateLimitSchema>;

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
] as const;

export type ModelDefinition = (typeof MODELS)[number];
export type ModelType = ModelDefinition["id"];

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

export function getProviderEnv(provider: ProviderType): string {
  return PROVIDERS[provider].env_var;
}

export const OpenAiTierSchema = z.enum(["tier_5"]);
export type OpenAiTier = z.infer<typeof OpenAiTierSchema>;

const OPENAI_TIER_5_MODEL_LIMITS: Record<ModelType, ProviderRateLimit> = {
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

const OPENAI_TIER_LIMITS: Record<OpenAiTier, Record<ModelType, ProviderRateLimit>> = {
  tier_5: OPENAI_TIER_5_MODEL_LIMITS,
};

export const OpenAiProviderSettingsSchema = z.object({
  tier: OpenAiTierSchema.default("tier_5"),
  modelRateLimitOverrides: z.partialRecord(
    modelTypeSchema,
    ProviderRateLimitSchema,
  ).default({}),
});

export type OpenAiProviderSettings = z.infer<typeof OpenAiProviderSettingsSchema>;

export const ProviderExecutionSettingsSchema = z.object({
  openai: OpenAiProviderSettingsSchema.default({
    tier: "tier_5",
    modelRateLimitOverrides: {},
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

export function resolveProviderRateLimit(
  providerSettings: ProviderExecutionSettings,
  provider: ProviderType,
  model: ModelType,
): ProviderRateLimit | null {
  if (provider !== "openai") {
    return null;
  }

  const tierLimits = OPENAI_TIER_LIMITS[providerSettings.openai.tier][model];
  const override = providerSettings.openai.modelRateLimitOverrides[model];

  return {
    ...tierLimits,
    ...(override ?? {}),
  };
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
