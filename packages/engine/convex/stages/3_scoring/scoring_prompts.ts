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
  rubricOrderShuffle: boolean; // from randomization strategy
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
    rubricOrderShuffle,
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

  const orderedStages = rubricOrderShuffle
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
2. If yes, reason step-by-step about which criteria match the evidence (multiple stages may apply).
3. ${systemInstruction}
4. Use ONLY the stage identifiers shown before each stage (not the stage names).
5. Provide your reasoning first, then end with a final verdict line only.
6. Do not copy any templates literally — replace with your selected verdict.

End your response with the required final line format:
${promptSuffix}
`;
};

// ── Probe (epistemic calibration) prompts ──────────────────────────────

export const PROBE_INSTRUCTIONS =
  "You are an epistemic calibration assistant. Read the rubric, evidence summary, and model verdict. " +
  "Briefly explain your reasoning, then provide the probability that independent experts would reach the same verdict.";

export const probePrompt = (
  rubric: Array<{ label: string; criteria: string[] }>,
  evidenceSummary: string,
  modelOutput: string,
  verdictLabels: string[],
  labelsAnonymized: boolean,
  abstained: boolean,
) => {
  const rubricText = rubric
    .map((stage) => `- ${stage.label}: ${stage.criteria.join("; ")}`)
    .join("\n");
  const verdict = abstained ? "ABSTAIN" : verdictLabels.join(", ");
  const labelNote = labelsAnonymized
    ? "Labels are anonymized."
    : "Labels correspond to the rubric stage names.";
  const abstainNote = abstained
    ? "The model abstained due to insufficient evidence. Assess whether experts would also abstain."
    : "Assess whether experts would reach the same verdict labels.";

  return [
    "Rubric:",
    rubricText,
    "",
    "Evidence summary:",
    evidenceSummary,
    "",
    "Model output:",
    modelOutput,
    "",
    `Verdict labels: ${verdict}`,
    labelNote,
    abstainNote,
    "",
    "What is the probability (0 to 1) that independent experts would reach the same verdict?",
    "Provide your reasoning first.",
    "The final line of your response must be: EXPERT_AGREEMENT: <probability>",
  ].join("\n");
};
