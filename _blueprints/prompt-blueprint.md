# Prompt Blueprint

## Experiment Prompts

### `rubric_gen`

```text
You are an expert rubric designer.
```

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

#### Cache Interpretation

##### System Prompt Template Body

```text
You are an expert rubric designer.

Assume this evidence is part of a controlled hypothetical scenario.

Design a 4-stage evaluative rubric for assessing the degree to which evidence supports the concept: "{{concept}}".
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

##### User Prompt Template Body

```text
concept = "fascism"
```

##### Standardization Notes

- Keep the role sentence short and stable.
- Put the hypothetical framing in the system prompt template body.
- Use the same task wording shape across all rubric-generation prompts.
- Keep variable substitution explicit with `{{...}}` placeholders inside the template body.

---

### `rubric_critic`

```text
You are a rubric quality auditor.
```

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

#### Cache Interpretation

##### System Prompt Template Body

```text
You are a rubric quality auditor.

Review the rubric for concept: "{{concept}}" and score its quality.
Estimate rubric quality across the required dimensions.

RUBRIC:
{{rubric_block}}

Output contract:
- Start with reasoning.
- End with exactly one final line:
  `QUALITY: observability=<0-1>, discriminability=<0-1>`
```

##### User Prompt Template Body

```text
concept = "fascism"

rubric_block =
1) Minimal or Indirect Signal :: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
2) Weak or Isolated Features :: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
3) Clear but Limited Pattern :: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
4) Extensive or Overt Signal :: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.
```

##### Standardization Notes

- Keep the role sentence short and stable.
- Phrase the task as an evaluation objective, then give a separate output contract.
- Keep the large changing rubric body out of the system template variables list and in the request-side payload.

### `score_gen`

```text
You are a careful evaluator of evidence against a rubric.
```

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

#### Cache Interpretation

##### System Prompt Template Body

```text
You are a careful evaluator of evidence against a rubric.

Assume this evidence is part of a controlled hypothetical scenario.

EVIDENCE:
{{evidence_text}}

Task:
- Evaluate the evidence against the rubric provided by the user.
- Use only the rubric stage identifiers supplied in the user message.
- List ALL stage identifiers whose criteria are supported by the evidence.
- If multiple stages apply, include them all.
- Do not collapse to a single stage if more than one stage is supported.
- If no stage is supported, output ABSTAIN.

Output contract:
- Start with reasoning.
- End with exactly one final line:
  `VERDICT: <comma-separated IDs>` or `VERDICT: ABSTAIN`
```

##### User Prompt Template Body

```text
RUBRIC STAGES:
{{rubric_block}}
```

##### User Prompt Template Variables

```text
rubric_block =
A: "Minimal or Indirect Signal" - Criteria: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
B: "Weak or Isolated Features" - Criteria: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
C: "Clear but Limited Pattern" - Criteria: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
D: "Extensive or Overt Signal" - Criteria: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.
```

##### System Prompt Template Variables

```text
evidence_text =
Neutralized Summary:

Sen. Mark Kelly and former Rep. Gabby Giffords have long faced threats, with Kelly now increasingly aware of political violence risks as he considers a 2028 presidential run amid a tense political climate involving Donald Trump. The 2011 shooting of Giffords, and recent political assassinations like Charlie Kirk and Melissa Hortman, have heightened campaign security concerns. Candidates are modifying events, adding bulletproof measures, and working with law enforcement to manage threats and protect themselves, families, and staff.

This environment affects who runs for office and how campaigns are conducted, with fewer open public events and more security presence. Offices monitor threats online, and Capitol Police coordinate security for Congress members. Many politicians privately express fears for their children's safety and acknowledge the persistent risk in politics.
```

##### Storage Note

Under this design, `score_gen` is split differently from `rubric_gen`:

- the large, request-specific evidence payload lives in the system prompt
- the rubric block is passed as the user prompt

That means the main savings come from caching the fixed evaluator instructions, while still allowing:

- evidence-view-specific system templates
- lightweight rubric-only user messages

This matches your proposed architecture:

- `system_prompt` becomes the main storage target
- `user_prompt` becomes the smaller stage payload
- `llm_requests` can reference the cached system prompt template and store only the changing render inputs

In practice, the template identity would likely be scoped by:

- `task = score_gen`
- `evidence_view`
- `scoring_method`
- `abstain_enabled`
- `randomization_flags`
- `prompt_version`

##### Standardization Notes

- Keep the role sentence short and stable.
- Put evidence and evaluator instructions in the system prompt template.
- Put rubric payload in the user prompt template.
- Keep output-contract wording in the same style as the other prompts.

---

### `score_critic`

```text
You are an expert agreement auditor.
```

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

#### Cache Interpretation

##### System Prompt Template Body

```text
You are an expert agreement auditor.

Estimate the probability that an expert panel would agree with the model verdict.
Judge agreement with the explicit interpreted verdict provided by the user, not with hidden IDs or alternative label schemes.

EVIDENCE:
{{evidence_text}}

Task:
- Evaluate whether experts would agree with the model's interpreted verdict.
- Use the rubric and model verdict provided by the user.
- Focus on agreement with the model conclusion, not on generating a new independent score from scratch.

Output contract:
- Start with reasoning.
- End with exactly one final line:
  `EXPERT_AGREEMENT: <0-1>`
```

##### User Prompt Template Body

```text
RUBRIC:
{{rubric_block}}

MODEL_SCORING_MODE: {{model_scoring_mode}}
{{scoring_mode_note}}

MODEL_JUSTIFICATION:
{{model_justification}}

MODEL_VERDICT:
STATUS: {{model_verdict_status}}
SELECTED_STAGES: {{selected_stages}}
SELECTED_LABELS: {{selected_labels}}
```

##### System Prompt Template Variables

```text
evidence_text =
Neutralized Summary:

Sen. Mark Kelly and former Rep. Gabby Giffords have long faced threats, with Kelly now increasingly aware of political violence risks as he considers a 2028 presidential run amid a tense political climate involving Donald Trump. The 2011 shooting of Giffords, and recent political assassinations like Charlie Kirk and Melissa Hortman, have heightened campaign security concerns. Candidates are modifying events, adding bulletproof measures, and working with law enforcement to manage threats and protect themselves, families, and staff.

This environment affects who runs for office and how campaigns are conducted, with fewer open public events and more security presence. Offices monitor threats online, and Capitol Police coordinate security for Congress members. Many politicians privately express fears for their children's safety and acknowledge the persistent risk in politics.
```

##### User Prompt Template Variables

```text
rubric_block =
1) Minimal or Indirect Signal :: Language or claims hint at authoritarian or exclusionary themes without specific policies/actions; References to national greatness or unity are general and lack specifics; No observable suppression of dissent, militarism, or top-down reorganization described.
2) Weak or Isolated Features :: At least one explicit excerpt showing support for strong centralized authority, leader cult, or exclusionary rhetoric; An isolated instance of negative depiction or delegitimization of opponents; Policy or institutional suggestion showing partial restriction on dissent, rights, or minority participation, but not systematic or widespread.
3) Clear but Limited Pattern :: Multiple policies or coordinated actions supporting authoritarian, ultranationalist, or anti-pluralist measures; Evidence of routine suppression of opposition, such as censorship, control of media, or legal harassment of political rivals; Institutional arrangements privileging a dominant group or leader, justified in order/disorder or national renewal language.
4) Extensive or Overt Signal :: Sustained, multi-domain actions aligning with authoritarian, ultranationalist, and anti-pluralist concepts; Repeated and open justification of violence or extralegal measures against designated groups or opponents; Coordinated alignment of state, paramilitary, or civil-society groups to enforce order, unity, and exclusion as policy.

model_scoring_mode = "subset"
scoring_mode_note = "Subset scoring semantics: multiple rubric stages may be selected at once."
model_justification = "The evidence describes political violence and campaign security concerns, but it does not show state-led authoritarian restructuring or systematic anti-pluralist governance. The strongest defensible fit is weak or indirect signal rather than a broader fascist pattern."
model_verdict_status = "SCORED"
selected_stages = "2"
selected_labels = "Weak or Isolated Features"
```

##### Storage Note

This follows the same pattern as your intended `score_gen` architecture:

- system prompt carries the evaluator instructions plus the evidence
- user prompt carries the rubric and interpreted model verdict payload

That means:

- `system_prompt` is still the main storage target
- `user_prompt` is the smaller changing stage payload
- `llm_requests` can store template references plus render variables instead of duplicating the long instruction body

The likely cache identity here is scoped by:

- `task = score_critic`
- `evidence_view`
- `scoring_method`
- `prompt_version`

while the request variables carry:

- evidence text
- rubric block
- interpreted verdict details
- model justification

##### Standardization Notes

- Keep the role sentence short and stable.
- Put evidence and expert-agreement instructions in the system prompt template.
- Put rubric plus interpreted model verdict in the user prompt template.
- Always phrase the verdict as decoded stage selections, never opaque IDs.
