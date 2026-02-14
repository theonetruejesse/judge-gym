import type { ExperimentConfig } from "../../../models/core";

export interface EvidenceStrategy {
  contentField:
    | "raw_content"
    | "cleaned_content"
    | "neutralized_content"
    | "abstracted_content";
}

export function resolveEvidenceStrategy(
  config: ExperimentConfig,
): EvidenceStrategy {
  const contentField = (() => {
    switch (config.evidence_view) {
      case "l1_cleaned":
        return "cleaned_content";
      case "l2_neutralized":
        return "neutralized_content";
      case "l3_abstracted":
        return "abstracted_content";
      default:
        return "raw_content";
    }
  })();
  return {
    contentField,
  };
}
