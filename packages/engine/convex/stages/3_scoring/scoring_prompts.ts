export const SCORING_INSTRUCTIONS = `
You are an expert political scientist evaluating evidence against a rubric.
You must reason step-by-step about which criteria match the evidence, then
produce a verdict. Do not consider the ordering of the rubric stages as
meaningful — evaluate purely on criteria match.
`;

interface ScoringPromptArgs {
  rubric: { stages: Array<{ label: string; criteria: string[] }> };
  content: string; // evidence content (raw or neutralized per strategy)
  labelMapping?: Record<string, number>;
  systemInstruction: string; // from strategy
  buildPromptSuffix: (labels: string[]) => string; // from strategy
  letterLabels: string[]; // from scale strategy (default A, B, C, D)
  rubricFirst: boolean; // from ordering strategy (Wei et al. ablation)
}

export const buildScoringPrompt = (args: ScoringPromptArgs): string => {
  const {
    rubric,
    content,
    labelMapping,
    systemInstruction,
    buildPromptSuffix,
    letterLabels,
    rubricFirst,
  } = args;

  // Resolve the actual labels for this sample:
  // - If randomized (labelMapping exists): nanoid keys
  // - Otherwise: letter labels from scale strategy
  const actualLabels: string[] = [];

  // Apply label mapping: assign display labels + rename
  const stages = rubric.stages.map((stage, i) => {
    const label = labelMapping
      ? (Object.entries(labelMapping).find(([, v]) => v === i + 1)?.[0] ??
        letterLabels[i])
      : letterLabels[i];
    actualLabels.push(label);
    return `${label}: "${stage.label}" — Criteria: ${stage.criteria.join("; ")}`;
  });

  // If randomized, shuffle the presentation order
  const orderedStages = labelMapping
    ? [...stages].sort(() => Math.random() - 0.5)
    : stages;

  const rubricBlock = `RUBRIC STAGES:\n${orderedStages.join("\n")}`;
  const evidenceBlock = `EVIDENCE:\n${content}`;

  // Wei et al. (2024): prompt ordering affects judge alignment
  const contextBlocks = rubricFirst
    ? `${rubricBlock}\n\n${evidenceBlock}`
    : `${evidenceBlock}\n\n${rubricBlock}`;

  // Build the verdict suffix from the actual labels
  const promptSuffix = buildPromptSuffix(actualLabels);

  return `
${contextBlocks}

TASK:
1. Determine if the evidence allows for a judgment (Abstain if not).
2. If yes, reason step-by-step about which criteria match the evidence.
3. ${systemInstruction}

End your response exactly like this:
${promptSuffix}
`;
};
