import type { ExperimentConfig } from "../schema";

export interface EvidenceStrategy {
  neutralize: boolean;
  contentField: "neutralizedContent" | "rawContent";
}

export function resolveEvidenceStrategy(
  config: ExperimentConfig,
): EvidenceStrategy {
  return {
    neutralize: config.neutralizeEvidence,
    contentField: config.neutralizeEvidence
      ? "neutralizedContent"
      : "rawContent",
  };
}
