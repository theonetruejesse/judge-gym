import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../utils/verdict_parser";
import type { ExperimentConfig } from "../schema";

export interface ScoringStrategy {
  promptSuffix: string;
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
      promptSuffix: "VERDICT: [A/B/C/D] or ABSTAIN",
      systemInstruction: "Conclude with a single letter verdict.",
      parseVerdict: parseSingleVerdict,
      useGenerateObject: false,
    },
    "freeform-suffix-subset": {
      promptSuffix:
        "VERDICT: [comma-separated letters, e.g. B,D] or ABSTAIN",
      systemInstruction:
        "List ALL stage labels whose criteria are supported by the evidence. " +
        "You may select one or more stages.",
      parseVerdict: parseSubsetVerdict,
      useGenerateObject: false,
    },
    "structured-json": {
      promptSuffix: "",
      systemInstruction: "Return your verdict as structured output.",
      parseVerdict: parseSingleVerdict,
      useGenerateObject: true,
    },
  };
  return strategies[config.scoringMethod];
}
