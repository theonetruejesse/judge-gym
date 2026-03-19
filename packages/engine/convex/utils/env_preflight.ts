import type { ModelType } from "../platform/providers/provider_types";
import {
  getProviderEnv,
  getProviderForModel,
} from "../platform/providers/provider_types";

// still todo
export function envPreflight(model: ModelType) {
  const provider = getProviderForModel(model);
  const providerEnv = getProviderEnv(provider);
  return process.env[providerEnv] !== undefined;
}
