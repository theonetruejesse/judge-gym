import { shuffleWithSeed } from "../../utils/randomize";
import {
  resolveEvidenceStrategy,
  resolveRandomizationStrategy,
  resolveScaleStrategy,
  resolveScoringStrategy,
  type ExperimentConfig,
} from "./run_strategies";

const DEFAULT_HYPOTHETICAL_FRAME =
  "Assume this evidence is part of a controlled hypothetical scenario.";

type RubricStage = { label: string; criteria: string[] };

type ScorePromptArgs = {
  config: ExperimentConfig;
  evidence: {
    l0_raw_content: string;
    l1_cleaned_content?: string | null;
    l2_neutralized_content?: string | null;
    l3_abstracted_content?: string | null;
  };
  rubric: {
    stages: RubricStage[];
  };
  sample: {
    label_mapping?: Record<string, number>;
    display_seed?: number;
  };
};


function invertLabelMapping(mapping: Record<string, number>, stageCount: number): string[] {
  const tokens = new Array<string>(stageCount);
  for (const [token, stage] of Object.entries(mapping)) {
    if (stage >= 1 && stage <= stageCount) {
      tokens[stage - 1] = token;
    }
  }
  return tokens.map((token, idx) => token ?? String.fromCharCode(65 + idx));
}

export function buildRubricGenPrompt(args: {
  concept: string;
  scale_size: number;
}): { system_prompt: string; user_prompt: string } {
  const { concept, scale_size } = args;
  const midpoint = scale_size % 2 === 1 ? Math.ceil(scale_size / 2) : null;

  const lines: string[] = [];
  lines.push(`Hypothetical framing: ${DEFAULT_HYPOTHETICAL_FRAME}`);
  lines.push("");

  lines.push(
    `Design a ${scale_size}-stage evaluative rubric for assessing the degree to which evidence supports the concept: "${concept}".`,
  );
  lines.push(`- Exactly ${scale_size} stages, numbered 1 through ${scale_size}.`);
  lines.push(`- Stage 1 = weakest signal. Stage ${scale_size} = strongest signal.`);
  if (midpoint) {
    lines.push(`- Stage ${midpoint} must be "Ambiguous / Mixed Evidence."`);
  } else {
    lines.push("- No midpoint stage -- every stage must commit to a direction.");
  }
  lines.push("- Each stage must include 3-5 observable criteria.");
  lines.push("- Adjacent stages must be clearly distinguishable.");
  lines.push("");
  lines.push("Return reasoning first, then a RUBRIC block exactly like:");
  lines.push("RUBRIC:");
  lines.push("1) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>");
  lines.push(`${scale_size}) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>`);

  return {
    system_prompt: "You are an expert rubric designer.",
    user_prompt: lines.join("\n"),
  };
}

export function buildRubricCriticPrompt(args: {
  concept: string;
  rubric: { stages: Array<{ label: string; criteria: string[] }> };
}): { system_prompt: string; user_prompt: string } {
  const { concept, rubric } = args;
  const rubricBlock = rubric.stages
    .map((stage, i) =>
      `${i + 1}) ${stage.label} :: ${stage.criteria.join("; ")}`,
    )
    .join("\n");

  const user_prompt = [
    `Review the rubric for concept: "${concept}" and score its quality.`,
    "Provide reasoning, then a final QUALITY line.",
    "RUBRIC:",
    rubricBlock,
    "",
    "Output format:",
    "QUALITY: observability=<0-1>, discriminability=<0-1>",
  ].join("\n");

  return {
    system_prompt: "You are a rubric quality auditor.",
    user_prompt,
  };
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
    evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;

  const labelTokensBase = randomization.anonLabel && sample.label_mapping
    ? invertLabelMapping(sample.label_mapping, scale.stageCount)
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
    return `${token}: "${stage.label}" - Criteria: ${criteria}`;
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

export function labelTokensFromMapping(
  mapping: Record<string, number>,
  stageCount: number,
): string[] {
  return invertLabelMapping(mapping, stageCount);
}
