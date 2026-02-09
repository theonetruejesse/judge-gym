export const RUBRIC_GENERATION_INSTRUCTIONS = `
You are a political scientist designing an evaluative rubric for
assessing evidence about a political concept. Your rubric must be
neutral, observable, and produce stages that are clearly distinguishable.
`;

export const rubricGenerationPrompt = (
  concept: string,
  scaleSize: number,
) => `
Design a ${scaleSize}-stage evaluative rubric for assessing the degree to
which news evidence reflects "${concept}" within the context of a modern nation-state.

REQUIREMENTS:
- Exactly ${scaleSize} stages, numbered 1 through ${scaleSize}.
- Stage 1 = weakest signal (minimal/absent). Stage ${scaleSize} = strongest signal.
${scaleSize % 2 === 1
    ? `- Stage ${Math.ceil(scaleSize / 2)} must be "Ambiguous / Mixed Evidence."`
    : "- No midpoint stage — every stage must commit to a direction."
  }
- Each stage needs:
  - label: A concise 3-5 word label (e.g., "Isolated Incidents", "Systematic Pattern")
  - criteria: 3-5 observable indicators that would place evidence at this stage.
    Each criterion must be verifiable from news reporting (not opinion).
- Adjacent stages must be clearly distinguishable. A reader should be able to
  classify evidence into exactly one stage without ambiguity.
- Criteria must be NEUTRAL — they describe institutional behaviors, not moral judgments.
  Use: "shift", "alignment", "pattern", "frequency". Avoid: "threat", "danger", "erosion".

Also provide reasoning: explain why these ${scaleSize} stages form a coherent
spectrum for evaluating "${concept}".

FORMAT:
- Begin with your reasoning in plain text.
- End your response with a rubric block exactly like this:

RUBRIC:
1) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>
2) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>
...
${scaleSize}) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>

Rules:
- Use semicolons to separate criteria.
- 3–5 criteria per stage.
- No extra text after the RUBRIC block.
`;

// todo, use the probe prompting methodology here

export const CRITIC_INSTRUCTIONS = `
You are a measurement quality auditor. You evaluate rubrics for
scientific rigor: can the criteria be observed, and can the stages
be discriminated from each other?
Adopt an expert-consensus stance: base judgments on what a panel of
domain experts would agree is observable and distinguishable from
news evidence, not your personal opinion.
`;

export const rubricCriticPrompt = (rubric: {
  stages: Array<{ label: string; criteria: string[] }>;
}) => `
Evaluate this rubric for two qualities:

RUBRIC:
${rubric.stages.map((s, i) => `Stage ${i + 1} — "${s.label}": ${s.criteria.join("; ")}`).join("\n")}

QUALITY 1: Observability (0.0 to 1.0)
- Can each criterion be verified from news evidence, as a typical expert
  reader would judge?
- Are criteria specific enough to be falsifiable by a consensus of experts?
- Deduct for vague terms like "significant", "notable", "concerning" that
  experts would not treat as operationally measurable.

QUALITY 2: Discriminability (0.0 to 1.0)
- Are adjacent stages clearly distinguishable to a panel of experts?
- Could trained expert raters reliably sort evidence into exactly one stage?
- Deduct for overlapping criteria between adjacent stages that experts would
  judge as ambiguous or redundant.

Provide your reasoning first. The last line of your response must be in this EXACT format:
QUALITY: observability=<number> discriminability=<number>
`;
