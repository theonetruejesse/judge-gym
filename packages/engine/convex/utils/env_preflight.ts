import { ModelType, ProviderType } from "../models/_shared";

// todo, figure this out later

const MODEL_ENV: Record<ModelType, ProviderType> = {
  "gpt-4.1": "openai",
  "gpt-4.1-mini": "openai",
  "gpt-5.2": "openai",
  "gpt-5.2-chat": "openai",
};

const PROVIDER_ENV: Record<ProviderType, string> = {
  openai: "OPENAI_API_KEY",
};


export function envPreflight(model: ModelType) {
  const provider = MODEL_ENV[model];
  const providerEnv = PROVIDER_ENV[provider];
  return process.env[providerEnv] !== undefined;
}
