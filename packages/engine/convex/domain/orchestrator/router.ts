import { ModelType } from "../../models/_shared";
import type { RunPolicy } from "../../platform/run_policy";

export const BATCHABLE_MODELS = new Set<ModelType>([
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-5.2",
]);

type RouterDecision = "batch" | "job";

export function decideRoute(options: {
  model: ModelType;
  count: number;
  policy: RunPolicy;
}): RouterDecision {
  const { model, count, policy } = options;

  if (!BATCHABLE_MODELS.has(model)) return "job";
  if (count < policy.min_batch_size) return "job";
  if (count <= policy.job_fallback_count) return "job";
  return "batch";
}
