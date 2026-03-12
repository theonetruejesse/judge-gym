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

export type ScoreCriticVerdictSummary = {
  method: ExperimentConfig["scoring_config"]["method"];
  status: "scored" | "abstain";
  selected_identifiers: string[];
};

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

function wrapXml(tag: string, content: string): string {
  return `<${tag}>\n${content}\n</${tag}>`;
}

function renderList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderRubricBlock(stages: Array<{ label: string; criteria: string[] }>): string {
  return stages
    .map((stage, index) => `${index + 1}) ${stage.label} :: ${stage.criteria.join("; ")}`)
    .join("\n");
}

type DisplayedRubricStage = {
  canonical_stage: number;
  token: string;
  label: string;
  criteria: string[];
};

function buildDisplayedRubricStages(args: {
  config: ExperimentConfig;
  rubric: { stages: RubricStage[] };
  sample: { label_mapping?: Record<string, number>; display_seed?: number };
}): {
  stages: DisplayedRubricStage[];
  tokensByCanonicalStage: string[];
} {
  const scale = resolveScaleStrategy(args.config);
  const randomization = resolveRandomizationStrategy(args.config);

  const labelTokensBase = randomization.anonLabel && args.sample.label_mapping
    ? invertLabelMapping(args.sample.label_mapping, scale.stageCount)
    : scale.letterLabels;

  const staged = args.rubric.stages.map((stage, idx) => ({
    canonical_stage: idx + 1,
    label: stage.label,
    criteria: stage.criteria,
    token: labelTokensBase[idx] ?? scale.letterLabels[idx],
  }));

  const displayedStages = randomization.rubricOrderShuffle
    ? shuffleWithSeed(staged, args.sample.display_seed)
    : staged;

  return {
    stages: displayedStages,
    tokensByCanonicalStage: staged
      .slice()
      .sort((left, right) => left.canonical_stage - right.canonical_stage)
      .map((stage) => stage.token),
  };
}

function renderDisplayedRubricLines(args: {
  config: ExperimentConfig;
  rubric: { stages: RubricStage[] };
  sample: { label_mapping?: Record<string, number>; display_seed?: number };
}) {
  const randomization = resolveRandomizationStrategy(args.config);
  const displayed = buildDisplayedRubricStages(args);
  const lines = displayed.stages.map((stage) => {
    const criteria = stage.criteria.join("; ");
    if (randomization.hideLabelName) {
      return `${stage.token}: Criteria: ${criteria}`;
    }
    return `${stage.token}: "${stage.label}" - Criteria: ${criteria}`;
  });
  return {
    lines,
    tokensByCanonicalStage: displayed.tokensByCanonicalStage,
  };
}

export function buildRubricGenPrompt(args: {
  concept: string;
  scale_size: number;
}): { system_prompt: string; user_prompt: string } {
  const { concept, scale_size } = args;
  const midpoint = scale_size % 2 === 1 ? Math.ceil(scale_size / 2) : null;
  const requirements = [
    `Produce exactly ${scale_size} stages, numbered 1 through ${scale_size}.`,
    `Stage 1 is the weakest signal. Stage ${scale_size} is the strongest signal.`,
    "Make the rubric usable on a single article excerpt with partial context.",
    "Treat this as signal-strength assessment, not definitive regime diagnosis.",
    "Base criteria on observable cues in text, such as actions, policies, institutional responses, and quoted claims.",
    "Do not use outside knowledge.",
    "Do not rely on hidden historical context or unstated background assumptions.",
    "Do not require hidden intent inference or complete historical coverage.",
    "Make lower and middle stages genuinely usable for weak, mixed, or partial support.",
    "Use neutral, descriptive, non-moralizing language.",
    midpoint
      ? `Stage ${midpoint} must be labeled "Ambiguous / Mixed Evidence."`
      : "Because this is an even-numbered scale, there is no midpoint stage.",
    "Include 3 to 5 criteria per stage.",
    "Make each stage meaningfully distinct from adjacent stages.",
  ];
  return {
    system_prompt: [
      wrapXml(
        "role",
        "You are an expert rubric designer. Your job is to create a stage-based rubric for evaluating how strongly evidence supports a concept.",
      ),
      wrapXml(
        "task",
        `Design a ${scale_size}-stage rubric for evaluating a concept. The concept will be provided by the user.`,
      ),
      wrapXml("requirements", renderList(requirements)),
      wrapXml(
        "output_contract",
        [
          "Start your response by explaining step by step how you reached your conclusion, using only the information provided here.",
          "Then output a single `RUBRIC:` block.",
          "Do not wrap the `RUBRIC:` block in markdown fences or backticks.",
          "Do not add any extra lines before, after, or between rubric stage lines.",
          "In that block, each line must use this format:",
          `\`${1}) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>\``,
          `\`${scale_size}) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>\``,
          "Example:",
          [
            "RUBRIC:",
            "1) Minimal or Indirect Signal :: Criterion one; Criterion two; Criterion three",
            "2) Weak or Isolated Features :: Criterion one; Criterion two; Criterion three",
            "3) Clear but Limited Pattern :: Criterion one; Criterion two; Criterion three",
            `${scale_size}) Extensive or Overt Signal :: Criterion one; Criterion two; Criterion three`,
          ].join("\n"),
        ].join("\n"),
      ),
    ].join("\n\n"),
    user_prompt: wrapXml("prompt_variables", `<concept>${concept}</concept>`),
  };
}

export function buildRubricCriticPrompt(args: {
  concept: string;
  rubric: { stages: Array<{ label: string; criteria: string[] }> };
}): { system_prompt: string; user_prompt: string } {
  const { concept, rubric } = args;
  return {
    system_prompt: [
      wrapXml(
        "role",
        "You are a rubric quality auditor. Your job is to judge whether a rubric is clear, observable, and well-structured for evaluating a concept.",
      ),
      wrapXml(
        "task",
        "Evaluate the quality of the rubric provided by the user for the concept provided by the user.",
      ),
      wrapXml(
        "evaluation_dimensions",
        [
          "Observability: how well the rubric relies on observable evidence cues.",
          "Discriminability: how clearly the stages are separated from each other.",
        ].join("\n"),
      ),
      wrapXml(
        "requirements",
        renderList([
          "Use only the information provided here.",
          "Do not use outside knowledge.",
          "Do not assume facts beyond the rubric text itself.",
          "Judge the rubric as a scoring instrument, not as a claim that the concept is present in any specific evidence item.",
        ]),
      ),
      wrapXml(
        "output_contract",
        [
          "Start your response by explaining step by step how you reached your conclusion, using only the information provided here.",
          "End with exactly one final line:",
          "`QUALITY: observability=<0-1>, discriminability=<0-1>`",
        ].join("\n"),
      ),
    ].join("\n\n"),
    user_prompt: [
      wrapXml("prompt_variables", `<concept>${concept}</concept>`),
      wrapXml("rubric", renderRubricBlock(rubric.stages)),
    ].join("\n\n"),
  };
}

export function buildScoreGenPrompt(args: ScorePromptArgs): {
  system_prompt: string;
  user_prompt: string;
  label_tokens: string[];
} {
  const { config, evidence, rubric, sample } = args;
  const scoring = resolveScoringStrategy(config);
  const evidenceStrategy = resolveEvidenceStrategy(config);

  const evidenceContent =
    evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
  const scoringRequirements = scoring.buildRequirements();
  const scoringOutputContract = scoring.buildOutputContract();
  const displayedRubric = renderDisplayedRubricLines({ config, rubric, sample });

  return {
    system_prompt: [
      wrapXml(
        "role",
        "You are a careful evaluator of evidence against a rubric. Assume the evidence is presented in a hypothetical evaluation scenario rather than as a claim about the full real-world regime.",
      ),
      wrapXml("evidence", evidenceContent),
      wrapXml(
        "task",
        config.scoring_config.evidence_grouping.mode === "bundle"
          ? "Evaluate the combined evidence set against the rubric provided by the user."
          : "Evaluate the evidence against the rubric provided by the user.",
      ),
      wrapXml(
        "requirements",
        renderList([
          "Use only the information provided here.",
          "Do not use outside knowledge.",
          "Do not infer unstated facts, motives, or background conditions.",
          config.scoring_config.evidence_grouping.mode === "bundle"
            ? "Judge the combined evidence set as one unit. Do not score the items separately."
            : "Judge the evidence item as one unit.",
          "Use only the rubric stage identifiers provided by the user.",
          ...scoringRequirements,
        ]),
      ),
      wrapXml(
        "output_contract",
        [
          "Start your response by explaining step by step how you reached your conclusion, using only the information provided here.",
          ...scoringOutputContract,
        ].join("\n"),
      ),
    ].join("\n\n"),
    user_prompt: wrapXml("rubric_stages", displayedRubric.lines.join("\n")),
    label_tokens: displayedRubric.tokensByCanonicalStage,
  };
}

export function buildScoreCriticPrompt(args: {
  config: ExperimentConfig;
  evidence: string;
  rubric: { stages: RubricStage[] };
  sample: { label_mapping?: Record<string, number>; display_seed?: number };
  verdict: ScoreCriticVerdictSummary;
  grouping_mode?: ExperimentConfig["scoring_config"]["evidence_grouping"]["mode"];
}): { system_prompt: string; user_prompt: string } {
  const displayedRubric = renderDisplayedRubricLines({
    config: args.config,
    rubric: args.rubric,
    sample: args.sample,
  });
  const selectedIdentifiers = args.verdict.selected_identifiers.length > 0
    ? args.verdict.selected_identifiers.join(", ")
    : "(none)";
  const scoringModeNote = args.verdict.method === "subset"
    ? "Subset scoring semantics: multiple rubric stages may be selected at once."
    : "Single scoring semantics: exactly one rubric stage should be selected unless the model abstained.";

  return {
    system_prompt: [
      wrapXml(
        "role",
        "You are an expert agreement auditor. Your job is to estimate how likely an expert panel would be to agree with a model verdict. Assume the evidence is presented in a hypothetical evaluation scenario rather than as a claim about the full real-world regime.",
      ),
      wrapXml("evidence", args.evidence),
      wrapXml(
        "task",
        "Estimate the probability that an expert panel would agree with the model verdict.",
      ),
      wrapXml(
        "requirements",
        renderList([
          "Use only the information provided here.",
          "Do not use outside knowledge.",
          "Do not infer unstated facts, motives, or background conditions.",
          args.grouping_mode === "bundle"
            ? "Judge agreement with the model's verdict about the combined evidence set."
            : "Judge agreement with the model's verdict about the evidence item.",
          "Judge agreement with the exact rubric presentation and verdict identifiers provided by the user.",
          "Evaluate agreement with the model's conclusion, not by independently rescoring from scratch.",
        ]),
      ),
      wrapXml(
        "output_contract",
        [
          "Start your response by explaining step by step how you reached your conclusion, using only the information provided here.",
          "End with exactly one final line:",
          "`EXPERT_AGREEMENT: <0-1>`",
        ].join("\n"),
      ),
    ].join("\n\n"),
    user_prompt: [
      wrapXml("rubric_stages", displayedRubric.lines.join("\n")),
      wrapXml(
        "model_verdict",
        [
          `<scoring_mode>${args.verdict.method}</scoring_mode>`,
          `<scoring_mode_definition>${scoringModeNote}</scoring_mode_definition>`,
          `<status>${args.verdict.status.toUpperCase()}</status>`,
          `<selected_identifiers>${selectedIdentifiers}</selected_identifiers>`,
        ].join("\n"),
      ),
    ].join("\n\n"),
  };
}

export function buildScoreCriticVerdictSummary(args: {
  decoded_scores: number[] | null | undefined;
  displayed_identifiers_by_stage: string[];
  method: ExperimentConfig["scoring_config"]["method"];
}): ScoreCriticVerdictSummary {
  const selectedStages = [...new Set((args.decoded_scores ?? [])
    .filter((score) => Number.isInteger(score))
    .filter((score) => score >= 1 && score <= args.displayed_identifiers_by_stage.length))]
    .sort((left, right) => left - right);
  return {
    method: args.method,
    status: selectedStages.length > 0 ? "scored" : "abstain",
    selected_identifiers: selectedStages
      .map((stageNumber) => args.displayed_identifiers_by_stage[stageNumber - 1] ?? `Stage ${stageNumber}`),
  };
}

export function labelTokensFromMapping(
  mapping: Record<string, number>,
  stageCount: number,
): string[] {
  return invertLabelMapping(mapping, stageCount);
}
