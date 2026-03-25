import type { EvidenceTransformStageKey } from "@judge-gym/engine-settings/process";

export function buildEvidenceTransformPrompt(args: {
  stage: EvidenceTransformStageKey;
  sourceText: string;
}) {
  const stageInstructions = (() => {
    switch (args.stage) {
      case "l1_cleaned":
        return [
          "Clean OCR noise and boilerplate without changing factual meaning.",
          "Remove navigation, copyright, and unrelated footer text.",
          "Preserve direct quotations, dates, named entities, and attribution.",
        ].join(" ");
      case "l2_neutralized":
        return [
          "Rewrite the passage into a neutral evidence summary.",
          "Keep factual claims, actors, dates, and actions intact.",
          "Remove rhetorical framing, emotional language, and persuasive style.",
        ].join(" ");
      case "l3_abstracted":
        return [
          "Abstract the passage into a compact analytical description.",
          "Retain concrete actions, institutions, and observable behaviors.",
          "Do not add interpretation beyond what the source supports.",
        ].join(" ");
    }
  })();

  return {
    system_prompt: [
      "You are preparing evidence views for a research engine.",
      stageInstructions,
      "Return exactly one block beginning with VIEW_TEXT: and nothing else after the transformed text.",
    ].join(" "),
    user_prompt: [
      `TARGET_VIEW: ${args.stage}`,
      "",
      "SOURCE_TEXT:",
      args.sourceText,
      "",
      "OUTPUT_FORMAT:",
      "VIEW_TEXT:",
      "<transformed text>",
    ].join("\n"),
  };
}
