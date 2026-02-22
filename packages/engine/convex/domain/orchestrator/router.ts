import type { ModelType } from "../../platform/providers/provider_types";
import { isBatchableModel } from "../../platform/providers/provider_types";
import type { RunPolicy } from "../../platform/run_policy";

type RouterDecision = "batch" | "job";

export function decideRoute(options: {
  model: ModelType;
  count: number;
  policy: RunPolicy;
}): RouterDecision {
  const { model, count, policy } = options;

  if (!isBatchableModel(model)) return "job";
  if (count < policy.min_batch_size) return "job";
  if (count <= policy.job_fallback_count) return "job";
  return "batch";
}
