import type { ExperimentConfig } from "../schema";

export interface OrderingStrategy {
  rubricFirst: boolean;
}

export function resolveOrderingStrategy(
  config: ExperimentConfig,
): OrderingStrategy {
  return { rubricFirst: config.promptOrdering === "rubric-first" };
}
