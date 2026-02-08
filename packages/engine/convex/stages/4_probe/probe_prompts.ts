export const PROBE_INSTRUCTIONS = `
You are an expert political scientist estimating inter-rater reliability.
You will be given a rubric (anonymized labels), the evidence that was
evaluated, and the model's reasoning + verdict. Your task is to estimate
the probability that independent experts would reach the same conclusion.
`;

export const probePrompt = (
  rubric: Array<{ label: string; criteria: string[] }>,
  evidenceSummary: string,
  modelOutput: string,
  verdictLabels: string[],
  labelsAnonymized: boolean,
) => `
A model evaluated the following evidence against an evaluative rubric and
produced the following reasoning and verdict.

${labelsAnonymized ? "RUBRIC (anonymized):" : "RUBRIC:"}
${rubric.map((s) => `${s.label}: ${s.criteria.join("; ")}`).join("\n")}

EVIDENCE SUMMARY:
${evidenceSummary.slice(0, 2000)}

MODEL OUTPUT (reasoning + verdict):
${modelOutput.slice(0, 2000)}

VERDICT LABELS:
${verdictLabels.join(", ")}

QUESTION:
What is the probability (0.0 to 1.0) that a panel of three political
science experts, working independently and with access to the same
evidence and rubric, would reach the same stage classification?

Consider:
- How clearly the evidence matches the criteria for this specific stage
- Whether adjacent stages could plausibly fit the evidence equally well
- Whether the criteria are sufficiently specific to constrain expert judgment

Respond with EXACTLY one line:
EXPERT_AGREEMENT: <number>
`;
