import type {
  QuotaDimension,
  QuotaReservationInput,
} from "@judge-gym/engine-settings";
import type {
  QuotaBucketPlan,
  QuotaBucketRef,
  TokenBucketPolicy,
} from "./types";

const MINUTE_MS = 60_000;

type DimensionPolicyMap = Partial<Record<QuotaDimension, TokenBucketPolicy>>;

const OPENAI_MODEL_POLICIES: Record<string, DimensionPolicyMap> = {
  "gpt-4.1": {
    requests: { rate: 10_000, periodMs: MINUTE_MS, capacity: 10_000 },
    input_tokens: { rate: 30_000_000, periodMs: MINUTE_MS, capacity: 30_000_000 },
    output_tokens: { rate: 30_000_000, periodMs: MINUTE_MS, capacity: 30_000_000 },
  },
  "gpt-4.1-mini": {
    requests: { rate: 30_000, periodMs: MINUTE_MS, capacity: 30_000 },
    input_tokens: { rate: 150_000_000, periodMs: MINUTE_MS, capacity: 150_000_000 },
    output_tokens: { rate: 150_000_000, periodMs: MINUTE_MS, capacity: 150_000_000 },
  },
  "gpt-5.2": {
    requests: { rate: 15_000, periodMs: MINUTE_MS, capacity: 15_000 },
    input_tokens: { rate: 40_000_000, periodMs: MINUTE_MS, capacity: 40_000_000 },
    output_tokens: { rate: 40_000_000, periodMs: MINUTE_MS, capacity: 40_000_000 },
  },
  "gpt-5.2-chat": {
    requests: { rate: 15_000, periodMs: MINUTE_MS, capacity: 15_000 },
    input_tokens: { rate: 40_000_000, periodMs: MINUTE_MS, capacity: 40_000_000 },
    output_tokens: { rate: 40_000_000, periodMs: MINUTE_MS, capacity: 40_000_000 },
  },
};

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

const PROVIDER_POLICIES: Record<string, DimensionPolicyMap> = {
  openai: sumPoliciesByDimension(OPENAI_MODEL_POLICIES),
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

  return OPENAI_MODEL_POLICIES[input.model]?.[ref.dimension] ?? null;
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
