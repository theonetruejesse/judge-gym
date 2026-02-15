import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../stages/scoring/scoring_parser";
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
  const abstainEnabled = config.scoring_stage.abstain_enabled;
  const strategies: Record<string, ScoringStrategy> = {
    single: {
      buildPromptSuffix: (labels) => {
        const options = labels.map((label) => `VERDICT: ${label}`).join("\n");
        if (!abstainEnabled) {
          return `Final line must be exactly one of:\n${options}`;
        }
        return `Final line must be exactly one of:\n${options}\nVERDICT: ABSTAIN`;
      },
      systemInstruction: abstainEnabled
        ? "Conclude with a single verdict from the options above."
        : "Conclude with a single verdict from the options above (no abstentions).",
      parseVerdict: (raw, labelMapping) => {
        const parsed = parseSingleVerdict(raw, labelMapping);
        if (!abstainEnabled && parsed.abstained) {
          throw new Error("Abstain not permitted by config");
        }
        return parsed;
      },
    },
    subset: {
      buildPromptSuffix: (labels) => {
        const base = `Final line must be: VERDICT: <comma-separated IDs from: ${labels.join(", ")}>`;
        if (!abstainEnabled) {
          return base;
        }
        return `${base} or VERDICT: ABSTAIN`;
      },
      systemInstruction:
        "List ALL stage identifiers whose criteria are supported by the evidence. " +
        "If multiple stages apply, include them all (do not collapse to a single stage)." +
        (abstainEnabled ? "" : " Do not abstain."),
      parseVerdict: (raw, labelMapping) => {
        const parsed = parseSubsetVerdict(raw, labelMapping);
        if (!abstainEnabled && parsed.abstained) {
          throw new Error("Abstain not permitted by config");
        }
        return parsed;
      },
    },
  };
  const strategy = strategies[config.scoring_stage.method];
  if (!strategy) {
    const allowed = Object.keys(strategies).join(", ");
    throw new Error(
      `Unknown scoring method "${config.scoring_stage.method}". Allowed: ${allowed}`,
    );
  }
  return strategy;
}
