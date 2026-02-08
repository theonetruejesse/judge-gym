export const PROBE_INSTRUCTIONS =
  "You are an epistemic calibration assistant. Read the rubric, evidence summary, and model verdict. " +
  "Return only the probability that independent experts would reach the same verdict.";

export const probePrompt = (
  rubric: Array<{ label: string; criteria: string[] }>,
  evidenceSummary: string,
  modelOutput: string,
  verdictLabels: string[],
  labelsAnonymized: boolean,
) => {
  const rubricText = rubric
    .map((stage) => `- ${stage.label}: ${stage.criteria.join("; ")}`)
    .join("\n");
  const verdict = verdictLabels.join(", ");
  const labelNote = labelsAnonymized
    ? "Labels are anonymized."
    : "Labels correspond to the rubric stage names.";

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
    "",
    "What is the probability (0 to 1) that independent experts would reach the same verdict?",
    "Reply with a single line: EXPERT_AGREEMENT: <probability>",
  ].join("\n");
};
