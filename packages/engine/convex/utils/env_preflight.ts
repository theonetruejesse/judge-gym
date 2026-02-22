import type { ModelType } from "../models/_shared";
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
