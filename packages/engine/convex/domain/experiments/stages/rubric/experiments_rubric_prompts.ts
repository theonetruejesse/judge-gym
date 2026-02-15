import type { ExperimentConfig } from "../../../../models/core";

const DEFAULT_HYPOTHETICAL_FRAME =
  "Assume this evidence is part of a controlled hypothetical scenario.";

export function buildRubricGenPrompt(args: {
  concept: string;
  scale_size: number;
  config: ExperimentConfig;
}): { system_prompt: string; user_prompt: string } {
  const { concept, scale_size } = args;
  const hypothetical_frame = DEFAULT_HYPOTHETICAL_FRAME;
  const midpoint = scale_size % 2 === 1 ? Math.ceil(scale_size / 2) : null;

  const lines: string[] = [];
  lines.push(`Hypothetical framing: ${hypothetical_frame}`);
  lines.push("");

  lines.push(
    `Design a ${scale_size}-stage evaluative rubric for assessing the degree to which evidence supports the concept: "${concept}".`,
  );
  lines.push(`- Exactly ${scale_size} stages, numbered 1 through ${scale_size}.`);
  lines.push(`- Stage 1 = weakest signal. Stage ${scale_size} = strongest signal.`);
  if (midpoint) {
    lines.push(`- Stage ${midpoint} must be "Ambiguous / Mixed Evidence."`);
  } else {
    lines.push("- No midpoint stage — every stage must commit to a direction.");
  }
  lines.push("- Each stage must include 3–5 observable criteria.");
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
