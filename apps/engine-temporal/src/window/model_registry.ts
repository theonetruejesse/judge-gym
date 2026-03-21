import {
  MODEL_BY_ID,
  getProviderForModel,
  getProviderModel,
  type ModelType,
} from "@judge-gym/engine-settings/provider";

type ModelConfig = {
  provider: ReturnType<typeof getProviderForModel>;
  providerModel: string;
};

export function getModelConfig(model: string): ModelConfig {
  if (!(model in MODEL_BY_ID)) {
    throw new Error(`Unsupported model for Temporal window workflow: ${model}`);
  }
  const typedModel = model as ModelType;
  return {
    provider: getProviderForModel(typedModel),
    providerModel: getProviderModel(typedModel),
  };
}
