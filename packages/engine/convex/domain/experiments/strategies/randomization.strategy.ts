import type { ExperimentConfig } from "../../../models/core";

export type RandomizationMode =
  | "anonymize_labels"
  | "shuffle_rubric_order"
  | "hide_label_text";

export interface RandomizationStrategy {
  anonLabel: boolean;
  rubricOrderShuffle: boolean;
  hideLabelName: boolean;
}

export function resolveRandomizationStrategy(
  config: ExperimentConfig,
): RandomizationStrategy {
  const modes = new Set<RandomizationMode>(config.scoring_stage.randomizations);
  return {
    anonLabel: modes.has("anonymize_labels"),
    rubricOrderShuffle: modes.has("shuffle_rubric_order"),
    hideLabelName: modes.has("hide_label_text"),
  };
}
