import z from "zod";

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

export const MODELS = [
  {
    id: "gpt-4.1",
    provider: "openai",
    batchable: true,
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    batchable: true,
  },
  {
    id: "gpt-5.2",
    provider: "openai",
    batchable: true,
  },
  {
    id: "gpt-5.2-chat",
    provider: "openai",
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

export function getProviderEnv(provider: ProviderType): string {
  return PROVIDERS[provider].env_var;
}

export type RateLimitScope = "job" | "batch";

export type RateLimitMetric = "requests" | "input_tokens" | "output_tokens";

export function rateLimitKey(
  model: string,
  metric: RateLimitMetric,
  scope: RateLimitScope = "job",
): string {
  const prefix = scope === "batch" ? "batch_" : "";
  return `${model}:${prefix}${metric}`;
}

export function rateLimitKeysForModel(
  model: string,
  scope: RateLimitScope = "job",
): {
  requestsKey: string;
  inputKey: string;
  outputKey: string;
} {
  return {
    requestsKey: rateLimitKey(model, "requests", scope),
    inputKey: rateLimitKey(model, "input_tokens", scope),
    outputKey: rateLimitKey(model, "output_tokens", scope),
  };
}
