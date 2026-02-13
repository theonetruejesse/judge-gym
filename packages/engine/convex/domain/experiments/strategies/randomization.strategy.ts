import type { ExperimentConfig } from "../../../models/core";

export type RandomizationMode =
  | "anon-label"
  | "rubric-order-shuffle"
  | "hide-label-name";

export interface RandomizationStrategy {
  anonLabel: boolean;
  rubricOrderShuffle: boolean;
  hideLabelName: boolean;
}

export function resolveRandomizationStrategy(
  config: ExperimentConfig,
): RandomizationStrategy {
  const modes = new Set<RandomizationMode>(config.randomizations);
  return {
    anonLabel: modes.has("anon-label"),
    rubricOrderShuffle: modes.has("rubric-order-shuffle"),
    hideLabelName: modes.has("hide-label-name"),
  };
}
