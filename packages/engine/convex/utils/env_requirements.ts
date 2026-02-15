import type { Provider } from "../models/core";
import { ENGINE_SETTINGS } from "../settings";
import { providerFor } from "../platform/utils/provider";
import type { ExperimentSpec } from "./config_normalizer";

const PROVIDER_ENV: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  // google: "GOOGLE_API_KEY",
};

export function requiredEnvsForExperiment(experiment: ExperimentSpec): string[] {
  const providers = new Set<Provider>();
  providers.add(providerFor(experiment.config.rubric_stage.model_id));
  providers.add(providerFor(experiment.config.scoring_stage.model_id));
  for (const spec of ENGINE_SETTINGS.run_policy.provider_models) {
    providers.add(spec.provider);
  }
  return Array.from(providers)
    .map((provider) => PROVIDER_ENV[provider])
    .filter((env): env is string => Boolean(env));
}

export const EVIDENCE_ENV_REQUIREMENTS = ["FIRECRAWL_API_KEY"];
