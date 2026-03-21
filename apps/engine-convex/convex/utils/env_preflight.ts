import type { ModelType } from "@judge-gym/engine-settings/provider";
import {
  getProviderEnv,
  getProviderForModel,
} from "@judge-gym/engine-settings/provider";

// still todo
export function envPreflight(model: ModelType) {
  const provider = getProviderForModel(model);
  const providerEnv = getProviderEnv(provider);
  return process.env[providerEnv] !== undefined;
}
