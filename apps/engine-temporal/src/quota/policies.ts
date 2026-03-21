import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import type {
  QuotaDimension,
  QuotaReservationInput,
} from "@judge-gym/engine-settings/quota";
import {
  MODEL_BY_ID,
  rateLimitToTokenBucketPolicies,
  resolveProviderRateLimit,
  type ModelType,
} from "@judge-gym/engine-settings/provider";
import type {
  QuotaBucketPlan,
  QuotaBucketRef,
  TokenBucketPolicy,
} from "./types";

type DimensionPolicyMap = Partial<Record<QuotaDimension, TokenBucketPolicy>>;

function sumPoliciesByDimension(
  models: Record<string, DimensionPolicyMap>,
): DimensionPolicyMap {
  const result: DimensionPolicyMap = {};
  for (const modelPolicies of Object.values(models)) {
    for (const [dimension, policy] of Object.entries(modelPolicies) as Array<
      [QuotaDimension, TokenBucketPolicy | undefined]
    >) {
      if (!policy) continue;
      const current = result[dimension];
      if (!current) {
        result[dimension] = { ...policy };
        continue;
      }
      current.rate += policy.rate;
      current.capacity += policy.capacity;
      current.periodMs = Math.max(current.periodMs, policy.periodMs);
    }
  }
  return result;
}

const MODEL_POLICIES: Record<string, DimensionPolicyMap> = Object.fromEntries(
  Object.values(MODEL_BY_ID).map((model) => [
    model.id,
    rateLimitToTokenBucketPolicies(
      resolveProviderRateLimit(
        DEFAULT_ENGINE_SETTINGS.providers,
        model.provider,
        model.id as ModelType,
      ),
    ),
  ]),
);

const PROVIDER_POLICIES: Record<string, DimensionPolicyMap> = {
  openai: sumPoliciesByDimension(
    Object.fromEntries(
      Object.values(MODEL_BY_ID)
        .filter((model) => model.provider === "openai")
        .map((model) => [model.id, MODEL_POLICIES[model.id] ?? {}]),
    ),
  ),
};

export function resolveQuotaBucketPolicy(
  ref: QuotaBucketRef,
  input: Pick<QuotaReservationInput, "provider" | "model">,
): TokenBucketPolicy | null {
  if (ref.scope === "scope") {
    return null;
  }

  if (ref.scope === "provider") {
    return PROVIDER_POLICIES[input.provider]?.[ref.dimension] ?? null;
  }

  if (!input.model) {
    return null;
  }

  return MODEL_POLICIES[input.model]?.[ref.dimension] ?? null;
}

export function buildQuotaBucketPlans(
  refs: QuotaBucketRef[],
  input: Pick<QuotaReservationInput, "provider" | "model" | "dimensions">,
): QuotaBucketPlan[] {
  const plans: QuotaBucketPlan[] = [];
  for (const ref of refs) {
    const amount = input.dimensions[ref.dimension];
    if (typeof amount !== "number" || amount <= 0) continue;

    const policy = resolveQuotaBucketPolicy(ref, input);
    if (!policy) continue;

    plans.push({
      ...ref,
      amount,
      policy,
    });
  }
  return plans;
}
