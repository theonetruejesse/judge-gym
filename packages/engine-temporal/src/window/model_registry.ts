type ModelConfig = {
  provider: "openai";
  providerModel: string;
};

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "gpt-4.1": {
    provider: "openai",
    providerModel: "gpt-4.1-2025-04-14",
  },
  "gpt-4.1-mini": {
    provider: "openai",
    providerModel: "gpt-4.1-mini-2025-04-14",
  },
  "gpt-5.2": {
    provider: "openai",
    providerModel: "gpt-5.2-2025-12-11",
  },
  "gpt-5.2-chat": {
    provider: "openai",
    providerModel: "gpt-5.2-chat-latest",
  },
};

export function getModelConfig(model: string): ModelConfig {
  const config = MODEL_REGISTRY[model];
  if (!config) {
    throw new Error(`Unsupported model for Temporal window workflow: ${model}`);
  }
  return config;
}
