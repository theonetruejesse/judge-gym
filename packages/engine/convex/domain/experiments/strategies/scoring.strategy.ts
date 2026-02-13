import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../stages/scoring/parsers/score_parser";
import type { ExperimentConfig } from "../../../models/core";

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
  const strategy = strategies[config.scoring_method];
  if (!strategy) {
    const allowed = Object.keys(strategies).join(", ");
    throw new Error(
      `Unknown scoring_method "${config.scoring_method}". Allowed: ${allowed}`,
    );
  }
  return strategy;
}
