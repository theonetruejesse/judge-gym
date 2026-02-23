import type { SemanticLevel } from "../../models/_shared";
import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "./run_parsers";

export type ExperimentConfig = {
  rubric_config: {
    scale_size: number;
    concept: string;
  };
  scoring_config: {
    method: "single" | "subset";
    abstain_enabled: boolean;
    evidence_view: SemanticLevel;
    randomizations: Array<
      "anonymize_stages" | "shuffle_rubric_order" | "hide_label_text"
    >;
  };
};

export type RandomizationMode =
  | "anonymize_stages"
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
  const modes = new Set<RandomizationMode>(config.scoring_config.randomizations);
  return {
    anonLabel: modes.has("anonymize_stages"),
    rubricOrderShuffle: modes.has("shuffle_rubric_order"),
    hideLabelName: modes.has("hide_label_text"),
  };
}

export interface ScaleStrategy {
  stageCount: number;
  hasMidpoint: boolean;
  midpointLabel: string | null;
  letterLabels: string[];
}

export function resolveScaleStrategy(config: ExperimentConfig): ScaleStrategy {
  const n = config.rubric_config.scale_size;
  const isOdd = n % 2 === 1;
  const letters = Array.from({ length: n }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  return {
    stageCount: n,
    hasMidpoint: isOdd,
    midpointLabel: isOdd ? letters[Math.floor(n / 2)] : null,
    letterLabels: letters,
  };
}

export interface EvidenceStrategy {
  contentField:
    | "l0_raw_content"
    | "l1_cleaned_content"
    | "l2_neutralized_content"
    | "l3_abstracted_content";
}

export function resolveEvidenceStrategy(
  config: ExperimentConfig,
): EvidenceStrategy {
  const contentField = (() => {
    switch (config.scoring_config.evidence_view) {
      case "l1_cleaned":
        return "l1_cleaned_content";
      case "l2_neutralized":
        return "l2_neutralized_content";
      case "l3_abstracted":
        return "l3_abstracted_content";
      default:
        return "l0_raw_content";
    }
  })();
  return {
    contentField,
  };
}

export interface ScoringStrategy {
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

export function resolveScoringStrategy(config: ExperimentConfig): ScoringStrategy {
  const abstainEnabled = config.scoring_config.abstain_enabled;
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
  const strategy = strategies[config.scoring_config.method];
  if (!strategy) {
    const allowed = Object.keys(strategies).join(", ");
    throw new Error(
      `Unknown scoring method "${config.scoring_config.method}". Allowed: ${allowed}`,
    );
  }
  return strategy;
}
