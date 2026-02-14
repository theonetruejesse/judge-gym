import type { ModelType, PolicyOverrides, Provider, RunPolicy } from "../models/core";
import { RunPolicySchema } from "../models/core";

function mergeRunPolicy(
  base: RunPolicy,
  override?: Partial<RunPolicy>,
): RunPolicy {
  if (!override) return base;
  return {
    ...base,
    ...override,
    provider_models: override.provider_models ?? base.provider_models,
  };
}

export function resolveRunPolicy(options: {
  policies: PolicyOverrides;
  team_id?: string;
  provider?: Provider;
  model?: ModelType;
}): RunPolicy {
  const { policies, team_id, provider, model } = options;
  let resolved = policies.global;
  if (team_id && policies.team?.[team_id]) {
    resolved = mergeRunPolicy(resolved, policies.team[team_id]);
  }
  if (provider && policies.provider?.[provider]) {
    resolved = mergeRunPolicy(resolved, policies.provider[provider]);
  }
  if (model && policies.model?.[model]) {
    resolved = mergeRunPolicy(resolved, policies.model[model]);
  }
  if (policies.experiment) {
    resolved = mergeRunPolicy(resolved, policies.experiment);
  }
  return RunPolicySchema.parse(resolved);
}

export function policyAllowsModel(
  policy: RunPolicy,
  provider: Provider,
  model: ModelType,
) {
  return policy.provider_models.some(
    (spec) => spec.provider === provider && spec.models.includes(model),
  );
}
