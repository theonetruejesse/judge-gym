import type { ExperimentConfig } from "../schema";

export interface EvidenceStrategy {
  contentField:
    | "rawContent"
    | "cleanedContent"
    | "neutralizedContent"
    | "abstractedContent";
}

export function resolveEvidenceStrategy(
  config: ExperimentConfig,
): EvidenceStrategy {
  const contentField = (() => {
    switch (config.evidenceView) {
      case "cleaned":
        return "cleanedContent";
      case "neutralized":
        return "neutralizedContent";
      case "abstracted":
        return "abstractedContent";
      default:
        return "rawContent";
    }
  })();
  return {
    contentField,
  };
}
