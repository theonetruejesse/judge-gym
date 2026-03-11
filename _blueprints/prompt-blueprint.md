# Prompt Blueprint

## `rubric_gen`

### Old System Prompt

```text
You are an expert rubric designer.
```

### Old User Prompt

```text
Hypothetical framing: Assume this evidence is part of a controlled hypothetical scenario.

Design a 4-stage evaluative rubric for assessing the degree to which evidence supports the concept: "fascism".
- Exactly 4 stages, numbered 1 through 4.
- Stage 1 = weakest signal. Stage 4 = strongest signal.
- Rubric must be usable on a single article excerpt with partial context.
- Treat this as signal-strength assessment, not definitive regime diagnosis.
- Criteria must rely on observable evidence cues in text (actions, policies, institutional responses, quoted claims).
- Do not require complete historical coverage or hidden intent inference to score.
- Lower and middle stages should explicitly capture weak/mixed/partial support to reduce forced abstention.
- Use neutral, descriptive, non-moralizing language.
- No midpoint stage -- every stage must commit to a direction.
- Each stage must include 3-5 observable criteria.
- Adjacent stages must be clearly distinguishable.

Return reasoning first, then a RUBRIC block exactly like:
RUBRIC:
1) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>
4) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>
```

### New System Prompt

```text
<role>
You are an expert rubric designer. Your job is to create a stage-based rubric for evaluating how strongly evidence supports a concept.
</role>

<task>
Design a 4-stage rubric for evaluating the concept "{{concept}}".
</task>

<requirements>
- Use only the information provided here.
- Do not use outside knowledge.
- Do not rely on hidden historical context or unstated background assumptions.
- Produce exactly 4 stages, numbered 1 through 4.
- Stage 1 is the weakest signal. Stage 4 is the strongest signal.
- Make the rubric usable on a single article excerpt with partial context.
- Treat this as signal-strength assessment, not definitive regime diagnosis.
- Base criteria on observable cues in text, such as actions, policies, institutional responses, and quoted claims.
- Do not require hidden intent inference or complete historical coverage.
- Make lower and middle stages genuinely usable for weak, mixed, or partial support.
- Use neutral, descriptive, non-moralizing language.
- Because this is a 4-stage scale, there is no midpoint stage.
- Include 3 to 5 criteria per stage.
- Make each stage meaningfully distinct from adjacent stages.
</requirements>

<output_contract>
- Start your response by explaining step by step how you reached your conclusion, using only the information provided here.
- Then output a single `RUBRIC:` block.
- In that block, each line must use this format:
  `<stage number>) <Stage Label> :: <criterion 1>; <criterion 2>; <criterion 3>`
</output_contract>
```

### New User Prompt

```text
<prompt_variables>
  <concept>fascism</concept>
</prompt_variables>
```

------

## `rubric_critic`

### Old System Prompt

```text
You are a rubric quality auditor.
```

### Old User Prompt

```text
Review the rubric for concept: "fascism" and score its quality.
Provide reasoning, then a final QUALITY line.

RUBRIC:
1) Minimal or Indirect Signal :: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
2) Weak or Isolated Features :: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
3) Clear but Limited Pattern :: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
4) Extensive or Overt Signal :: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.

Output format:
QUALITY: observability=<0-1>, discriminability=<0-1>
```

### New System Prompt

```text
<role>
You are a rubric quality auditor. Your job is to judge whether a rubric is clear, observable, and well-structured for evaluating a concept.
</role>

<task>
Evaluate the quality of a rubric for the concept "{{concept}}".
</task>

<evaluation_dimensions>
- Observability: how well the rubric relies on observable evidence cues.
- Discriminability: how clearly the stages are separated from each other.
</evaluation_dimensions>

<requirements>
- Use only the information provided here.
- Do not use outside knowledge.
- Do not assume facts beyond the rubric text itself.
- Judge the rubric as a scoring instrument, not as a claim that the concept is present in any specific evidence item.
</requirements>

<output_contract>
- Start your response by explaining step by step how you reached your conclusion, using only the information provided here.
- End with exactly one final line:
  `QUALITY: observability=<0-1>, discriminability=<0-1>`
</output_contract>
```

### New User Prompt

```text
<prompt_variables>
  <concept>fascism</concept>
</prompt_variables>

<rubric>
1) Minimal or Indirect Signal :: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
2) Weak or Isolated Features :: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
3) Clear but Limited Pattern :: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
4) Extensive or Overt Signal :: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.
</rubric>
```

------

## `score_gen`

### Old System Prompt

```text
You are a careful evaluator of evidence against a rubric.
```

### Old User Prompt

```text
Hypothetical framing: Assume this evidence is part of a controlled hypothetical scenario.

RUBRIC STAGES:
A: "Minimal or Indirect Signal" - Criteria: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
B: "Weak or Isolated Features" - Criteria: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
C: "Clear but Limited Pattern" - Criteria: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
D: "Extensive or Overt Signal" - Criteria: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.

EVIDENCE:
Neutralized Summary:

Sen. Mark Kelly and former Rep. Gabby Giffords have long faced threats, with Kelly now increasingly aware of political violence risks as he considers a 2028 presidential run amid a tense political climate involving Donald Trump. The 2011 shooting of Giffords, and recent political assassinations like Charlie Kirk and Melissa Hortman, have heightened campaign security concerns. Candidates are modifying events, adding bulletproof measures, and working with law enforcement to manage threats and protect themselves, families, and staff.

This environment affects who runs for office and how campaigns are conducted, with fewer open public events and more security presence. Offices monitor threats online, and Capitol Police coordinate security for Congress members. Many politicians privately express fears for their children's safety and acknowledge the persistent risk in politics.

List ALL stage identifiers whose criteria are supported by the evidence. If multiple stages apply, include them all (do not collapse to a single stage).
Final line must be: VERDICT: <comma-separated IDs from: A, B, C, D> or VERDICT: ABSTAIN
```

### New System Prompt

```text
<role>
You are a careful evaluator of evidence against a rubric. Assume the evidence is presented in a hypothetical evaluation scenario rather than as a claim about the full real-world regime.
</role>

<evidence>
{{evidence_text}}
</evidence>

<task>
Evaluate the evidence against the rubric provided by the user.
</task>

<requirements>
- Use only the information provided here.
- Do not use outside knowledge.
- Do not infer unstated facts, motives, or background conditions.
- Use only the rubric stage identifiers provided by the user.
- Select every stage identifier whose criteria are supported by the evidence.
- Select a stage only if its criteria are affirmatively supported by the evidence.
- If multiple stages are supported, include all of them.
- Do not collapse to a single stage if more than one applies.
- Output `ABSTAIN` only if no stage is sufficiently supported by the evidence.
</requirements>

<output_contract>
- Start your response by explaining step by step how you reached your conclusion, using only the information provided here.
- End with exactly one final line:
  `VERDICT: <comma-separated IDs>` or `VERDICT: ABSTAIN`
</output_contract>
```

### New User Prompt

```text
<rubric_stages>
A: "Minimal or Indirect Signal" - Criteria: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
B: "Weak or Isolated Features" - Criteria: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
C: "Clear but Limited Pattern" - Criteria: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
D: "Extensive or Overt Signal" - Criteria: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.
</rubric_stages>
```

------

## `score_critic`

### Old System Prompt

```text
You are an expert agreement auditor.
```

### Old User Prompt

```text
Estimate the probability that an expert panel would agree with the model verdict.
Judge agreement with the explicit interpreted verdict below, not with hidden IDs or alternative label schemes.
Start your response by explaining your reasoning, then end your response with the final line:
EXPERT_AGREEMENT: <0-1>

EVIDENCE:
Neutralized Summary:

Sen. Mark Kelly and former Rep. Gabby Giffords have long faced threats, with Kelly now increasingly aware of political violence risks as he considers a 2028 presidential run amid a tense political climate involving Donald Trump. The 2011 shooting of Giffords, and recent political assassinations like Charlie Kirk and Melissa Hortman, have heightened campaign security concerns. Candidates are modifying events, adding bulletproof measures, and working with law enforcement to manage threats and protect themselves, families, and staff.

This environment affects who runs for office and how campaigns are conducted, with fewer open public events and more security presence. Offices monitor threats online, and Capitol Police coordinate security for Congress members. Many politicians privately express fears for their children's safety and acknowledge the persistent risk in politics.

RUBRIC:
1) Minimal or Indirect Signal :: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
2) Weak or Isolated Features :: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
3) Clear but Limited Pattern :: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
4) Extensive or Overt Signal :: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.

MODEL_SCORING_MODE: subset
Subset scoring semantics: multiple rubric stages may be selected at once.

MODEL_JUSTIFICATION:
The evidence describes political violence and campaign security concerns, but it does not show state-led authoritarian restructuring or systematic anti-pluralist governance. The strongest defensible fit is weak or indirect signal rather than a broader fascist pattern.

MODEL_VERDICT:
STATUS: SCORED
SELECTED_STAGES: 2
SELECTED_LABELS: Weak or Isolated Features
```

### New System Prompt

```text
<role>
You are an expert agreement auditor. Your job is to estimate how likely an expert panel would be to agree with a model verdict. Assume the evidence is presented in a hypothetical evaluation scenario rather than as a claim about the full real-world regime.
</role>

<evidence>
{{evidence_text}}
</evidence>

<task>
Estimate the probability that an expert panel would agree with the model verdict.
</task>

<requirements>
- Use only the information provided here.
- Do not use outside knowledge.
- Do not infer unstated facts, motives, or background conditions.
- Judge agreement with the interpreted verdict provided by the user.
- Do not rely on hidden IDs, opaque identifiers, or alternative label schemes.
- Evaluate agreement with the model's conclusion, not by independently rescoring from scratch.
</requirements>

<output_contract>
- Start your response by explaining step by step how you reached your conclusion, using only the information provided here.
- End with exactly one final line:
  `EXPERT_AGREEMENT: <0-1>`
</output_contract>
```

### New User Prompt

```text
<rubric>
1) Minimal or Indirect Signal :: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
2) Weak or Isolated Features :: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
3) Clear but Limited Pattern :: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
4) Extensive or Overt Signal :: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.
</rubric>

<model_verdict>
  <scoring_mode>subset</scoring_mode>
  <scoring_mode_definition>Multiple rubric stages may be selected if each selected stage is supported by the evidence.</scoring_mode_definition>
  <justification>The evidence describes political violence and campaign security concerns, but it does not show state-led authoritarian restructuring or systematic anti-pluralist governance. The strongest defensible fit is weak or indirect signal rather than a broader fascist pattern.</justification>
  <status>SCORED</status>
  <selected_stages>2</selected_stages>
  <selected_labels>Weak or Isolated Features</selected_labels>
</model_verdict>
```
