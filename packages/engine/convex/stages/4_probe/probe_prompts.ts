export const PROBE_INSTRUCTIONS = `
You are an expert political scientist estimating inter-rater reliability.
You will be given a verdict and its supporting criteria, along with the
evidence that was evaluated. Your task is to estimate the probability
that independent experts would reach the same conclusion.
`;

export const probePrompt = (
  stageLabel: string,
  stageCriteria: string[],
  evidenceSummary: string,
) => `
A model evaluated the following evidence against an evaluative rubric and
concluded that the evidence best corresponds to this stage:

STAGE: "${stageLabel}"
CRITERIA:
${stageCriteria.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}

EVIDENCE SUMMARY:
${evidenceSummary.slice(0, 2000)}

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
