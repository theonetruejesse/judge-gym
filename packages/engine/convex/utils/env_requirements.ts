import type { Provider } from "../models/core";
import { providerFor } from "../platform/utils/provider";
import type { ConfigTemplateBody } from "./config_normalizer";

const PROVIDER_ENV: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  // google: "GOOGLE_API_KEY",
};

export function requiredEnvsForConfig(body: ConfigTemplateBody): string[] {
  const providers = new Set<Provider>();
  providers.add(providerFor(body.experiment.config.rubric_model_id));
  providers.add(providerFor(body.experiment.config.scoring_model_id));
  for (const spec of body.policies.global.provider_models) {
    providers.add(spec.provider);
  }
  return Array.from(providers)
    .map((provider) => PROVIDER_ENV[provider])
    .filter((env): env is string => Boolean(env));
}

export const EVIDENCE_ENV_REQUIREMENTS = ["FIRECRAWL_API_KEY"];
