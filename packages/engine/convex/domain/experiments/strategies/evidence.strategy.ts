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
      case "cleaned":
        return "cleaned_content";
      case "neutralized":
        return "neutralized_content";
      case "abstracted":
        return "abstracted_content";
      default:
        return "raw_content";
    }
  })();
  return {
    contentField,
  };
}
