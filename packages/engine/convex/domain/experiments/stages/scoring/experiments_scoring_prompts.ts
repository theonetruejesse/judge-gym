import { resolveEvidenceStrategy } from "../../strategies/experiments_evidence.strategy";
import { resolveRandomizationStrategy } from "../../strategies/experiments_randomization.strategy";
import { resolveScaleStrategy } from "../../strategies/experiments_scale.strategy";
import { resolveScoringStrategy } from "../../strategies/experiments_scoring.strategy";
import type { ExperimentConfig } from "../../../../models/core";

const DEFAULT_HYPOTHETICAL_FRAME =
  "Assume this evidence is part of a controlled hypothetical scenario.";

type RubricStage = { label: string; criteria: string[] };

type ScorePromptArgs = {
  config: ExperimentConfig;
  evidence: {
    raw_content: string;
    cleaned_content?: string;
    neutralized_content?: string;
    abstracted_content?: string;
  };
  rubric: {
    stages: RubricStage[];
  };
  sample: {
    label_mapping?: Record<string, number>;
    display_seed?: number;
  };
};

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed?: number): T[] {
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function invertLabelMapping(mapping: Record<string, number>): string[] {
  const max = Math.max(...Object.values(mapping));
  const tokens = new Array<string>(max);
  for (const [token, stage] of Object.entries(mapping)) {
    tokens[stage - 1] = token;
  }
  return tokens;
}

export function buildScoreGenPrompt(args: ScorePromptArgs): {
  system_prompt: string;
  user_prompt: string;
  label_tokens: string[];
} {
  const { config, evidence, rubric, sample } = args;
  const scoring = resolveScoringStrategy(config);
  const scale = resolveScaleStrategy(config);
  const randomization = resolveRandomizationStrategy(config);
  const evidenceStrategy = resolveEvidenceStrategy(config);

  const evidenceContent =
    evidence[evidenceStrategy.contentField] ?? evidence.raw_content;

  const labelTokensBase = randomization.anonLabel && sample.label_mapping
    ? invertLabelMapping(sample.label_mapping)
    : scale.letterLabels;

  const labelTokens = labelTokensBase;

  const stages = rubric.stages.map((stage, idx) => ({
    stage,
    token: labelTokens[idx] ?? scale.letterLabels[idx],
  }));

  const stagedForPrompt = randomization.rubricOrderShuffle
    ? shuffleWithSeed(stages, sample.display_seed)
    : stages;

  const rubricLines = stagedForPrompt.map(({ stage, token }) => {
    const criteria = stage.criteria.join("; ");
    if (randomization.hideLabelName) {
      return `${token}: Criteria: ${criteria}`;
    }
    return `${token}: "${stage.label}" — Criteria: ${criteria}`;
  });

  const promptParts: string[] = [];
  promptParts.push(`Hypothetical framing: ${DEFAULT_HYPOTHETICAL_FRAME}`);
  promptParts.push("");

  const rubricBlock = `RUBRIC STAGES:\n${rubricLines.join("\n")}`;
  const evidenceBlock = `EVIDENCE:\n${evidenceContent}`;

  promptParts.push(rubricBlock);
  promptParts.push("");
  promptParts.push(evidenceBlock);

  promptParts.push("");
  promptParts.push(scoring.systemInstruction);
  promptParts.push(scoring.buildPromptSuffix(labelTokens));

  return {
    system_prompt: "You are a careful evaluator of evidence against a rubric.",
    user_prompt: promptParts.join("\n"),
    label_tokens: labelTokens,
  };
}

export function buildScoreCriticPrompt(args: {
  evidence: string;
  rubric: RubricStage[];
  verdict: string | null;
}): { system_prompt: string; user_prompt: string } {
  const rubricBlock = args.rubric
    .map((stage, idx) => `${idx + 1}) ${stage.label} :: ${stage.criteria.join("; ")}`)
    .join("\n");

  const user_prompt = [
    "Estimate the probability that an expert panel would agree with the model verdict.",
    "Provide reasoning, then the final line:",
    "EXPERT_AGREEMENT: <0-1>",
    "",
    "EVIDENCE:",
    args.evidence,
    "",
    "RUBRIC:",
    rubricBlock,
    "",
    `MODEL_VERDICT: ${args.verdict ?? "(none)"}`,
  ].join("\n");

  return {
    system_prompt: "You are an expert agreement auditor.",
    user_prompt,
  };
}
