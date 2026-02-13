import type { ExperimentConfig } from "../../../models/core";

export interface OrderingStrategy {
  rubricFirst: boolean;
}

export function resolveOrderingStrategy(
  config: ExperimentConfig,
): OrderingStrategy {
  return { rubricFirst: config.prompt_ordering === "rubric-first" };
}
