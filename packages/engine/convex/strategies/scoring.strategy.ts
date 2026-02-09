import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../stages/3_scoring/scoring_parsers";
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
}

export function resolveScoringStrategy(
  config: ExperimentConfig,
): ScoringStrategy {
  const strategies: Record<string, ScoringStrategy> = {
    "freeform-suffix-single": {
      buildPromptSuffix: (labels) =>
        `Final line must be exactly one of:\n${labels.map((label) => `VERDICT: ${label}`).join("\n")}\nVERDICT: ABSTAIN`,
      systemInstruction: "Conclude with a single verdict from the options above.",
      parseVerdict: parseSingleVerdict,
    },
    "freeform-suffix-subset": {
      buildPromptSuffix: (labels) =>
        `Final line must be: VERDICT: <comma-separated IDs from: ${labels.join(", ")}> or VERDICT: ABSTAIN`,
      systemInstruction:
        "List ALL stage identifiers whose criteria are supported by the evidence. " +
        "If multiple stages apply, include them all (do not collapse to a single stage).",
      parseVerdict: parseSubsetVerdict,
    },
  };
  const strategy = strategies[config.scoringMethod];
  if (!strategy) {
    const allowed = Object.keys(strategies).join(", ");
    throw new Error(
      `Unknown scoringMethod "${config.scoringMethod}". Allowed: ${allowed}`,
    );
  }
  return strategy;
}
