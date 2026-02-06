import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../utils/verdict_parser";
import type { ExperimentConfig } from "../schema";

export interface ScoringStrategy {
  /** Build the verdict suffix line given the actual labels for this sample. */
  buildPromptSuffix: (labels: string[]) => string;
  systemInstruction: string;
  parseVerdict: (
    raw: string,
    labelMapping?: Record<string, number>,
  ) => {
    rawVerdict: string | null;
    decodedScores: number[] | null;
    abstained: boolean;
  };
  useGenerateObject: boolean;
}

export function resolveScoringStrategy(
  config: ExperimentConfig,
): ScoringStrategy {
  const strategies: Record<string, ScoringStrategy> = {
    "freeform-suffix-single": {
      buildPromptSuffix: (labels) =>
        `VERDICT: [${labels.join("/")}] or ABSTAIN`,
      systemInstruction: "Conclude with a single verdict from the options above.",
      parseVerdict: parseSingleVerdict,
      useGenerateObject: false,
    },
    "freeform-suffix-subset": {
      buildPromptSuffix: (labels) =>
        `VERDICT: [comma-separated IDs, e.g. ${labels.slice(0, 2).join(",")}] or ABSTAIN`,
      systemInstruction:
        "List ALL stage identifiers whose criteria are supported by the evidence. " +
        "You may select one or more stages.",
      parseVerdict: parseSubsetVerdict,
      useGenerateObject: false,
    },
    "structured-json": {
      buildPromptSuffix: () => "",
      systemInstruction: "Return your verdict as structured output.",
      parseVerdict: parseSingleVerdict,
      useGenerateObject: true,
    },
  };
  return strategies[config.scoringMethod];
}
