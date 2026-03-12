import { describe, expect, test } from "vitest";
import {
  buildRubricCriticPrompt,
  buildRubricGenPrompt,
  buildScoreCriticPrompt,
  buildScoreCriticVerdictSummary,
  buildScoreGenPrompt,
} from "../domain/runs/run_prompts";
import { parseRubricResponse } from "../domain/runs/run_parsers";

describe("run prompts", () => {
  test("renders rubric generation prompts with XML structure", () => {
    const prompt = buildRubricGenPrompt({
      concept: "fascism",
      scale_size: 4,
    });

    expect(prompt.system_prompt).toContain("<role>");
    expect(prompt.system_prompt).toContain("Design a 4-stage rubric");
    expect(prompt.system_prompt).toContain("Do not use outside knowledge.");
    expect(prompt.system_prompt).toContain("<output_contract>");
    expect(prompt.system_prompt).toContain("Do not wrap the `RUBRIC:` block in markdown fences or backticks.");
    expect(prompt.system_prompt).toContain("Example:");
    expect(prompt.system_prompt).toContain("1) Minimal or Indirect Signal :: Criterion one; Criterion two; Criterion three");
    expect(prompt.user_prompt).toContain("<prompt_variables>");
    expect(prompt.user_prompt).toContain("<concept>fascism</concept>");
  });

  test("parses rubric blocks even if the model adds markdown fences", () => {
    const parsed = parseRubricResponse(
      [
        "Step 1: I identified observable signals only.",
        "RUBRIC:",
        "```",
        "1) Minimal or Indirect Signal :: criterion one; criterion two; criterion three",
        "2) Weak or Isolated Features :: criterion one; criterion two; criterion three",
        "3) Clear but Limited Pattern :: criterion one; criterion two; criterion three",
        "4) Extensive or Overt Signal :: criterion one; criterion two; criterion three",
        "```",
      ].join("\n"),
      4,
    );

    expect(parsed.reasoning).toContain("observable signals");
    expect(parsed.stages).toHaveLength(4);
    expect(parsed.stages[0]?.label).toBe("Minimal or Indirect Signal");
  });

  test("renders rubric critic prompts with concept and rubric split", () => {
    const prompt = buildRubricCriticPrompt({
      concept: "fascism",
      rubric: {
        stages: [
          { label: "Minimal", criteria: ["a", "b", "c"] },
          { label: "Weak", criteria: ["a", "b", "c"] },
        ],
      },
    });

    expect(prompt.system_prompt).toContain("<evaluation_dimensions>");
    expect(prompt.system_prompt).toContain("Do not assume facts beyond the rubric text itself.");
    expect(prompt.user_prompt).toContain("<prompt_variables>");
    expect(prompt.user_prompt).toContain("<concept>fascism</concept>");
    expect(prompt.user_prompt).toContain("<rubric>");
    expect(prompt.user_prompt).toContain("1) Minimal :: a; b; c");
  });

  test("renders score generation prompts with evidence in system and rubric in user", () => {
    const prompt = buildScoreGenPrompt({
      config: {
        rubric_config: {
          scale_size: 4,
          concept: "fascism",
        },
        scoring_config: {
          method: "subset",
          abstain_enabled: true,
          evidence_view: "l2_neutralized",
          randomizations: [],
          evidence_grouping: {
            mode: "single_evidence",
          },
        },
      },
      evidence: {
        l0_raw_content: "Raw evidence",
        l2_neutralized_content: "Neutralized evidence",
      },
      rubric: {
        stages: [
          { label: "Minimal", criteria: ["a", "b", "c"] },
          { label: "Weak", criteria: ["a", "b", "c"] },
          { label: "Clear", criteria: ["a", "b", "c"] },
          { label: "Extensive", criteria: ["a", "b", "c"] },
        ],
      },
      sample: {},
    });

    expect(prompt.system_prompt).toContain("<evidence>");
    expect(prompt.system_prompt).toContain("Neutralized evidence");
    expect(prompt.system_prompt).toContain("Do not use outside knowledge.");
    expect(prompt.system_prompt).toContain("Select every rubric stage identifier from the user-provided rubric whose criteria are affirmatively supported by the evidence.");
    expect(prompt.system_prompt).toContain("End with exactly one final line in one of these forms:");
    expect(prompt.system_prompt).toContain("`VERDICT: <comma-separated rubric stage identifiers from the user prompt>`");
    expect(prompt.system_prompt).toContain("`VERDICT: ABSTAIN`");
    expect(prompt.user_prompt).toContain("<rubric_stages>");
    expect(prompt.user_prompt).toContain("A: \"Minimal\" - Criteria: a; b; c");
    expect(prompt.label_tokens).toEqual(["A", "B", "C", "D"]);
  });

  test("builds score critic verdict summaries from decoded stages", () => {
    const verdict = buildScoreCriticVerdictSummary({
      decoded_scores: [4, 2, 4],
      displayed_identifiers_by_stage: ["A", "B", "C", "D"],
      method: "subset",
    });

    expect(verdict).toEqual({
      method: "subset",
      status: "scored",
      selected_identifiers: ["B", "D"],
    });
  });

  test("renders score critic prompts with randomized rubric surface", () => {
    const prompt = buildScoreCriticPrompt({
      config: {
        rubric_config: {
          scale_size: 4,
          concept: "fascism",
        },
        scoring_config: {
          method: "subset",
          abstain_enabled: true,
          evidence_view: "l2_neutralized",
          randomizations: ["anonymize_stages", "hide_label_text", "shuffle_rubric_order"],
          evidence_grouping: {
            mode: "single_evidence",
          },
        },
      },
      evidence: "Neutralized Summary:\nInstitutional pressure escalated.",
      rubric: {
        stages: [
          { label: "Minimal", criteria: ["a", "b", "c"] },
          { label: "Weak", criteria: ["d", "e", "f"] },
          { label: "Clear", criteria: ["g", "h", "i"] },
          { label: "Extensive", criteria: ["j", "k", "l"] },
        ],
      },
      sample: {
        label_mapping: {
          QBIqOe: 1,
          "1PV7Cj": 2,
          C3Phqx: 3,
          hIbjkx: 4,
        },
        display_seed: 42,
      },
      verdict: {
        method: "subset",
        status: "scored",
        selected_identifiers: ["1PV7Cj", "hIbjkx"],
      },
    });

    expect(prompt.system_prompt).toContain("<evidence>");
    expect(prompt.system_prompt).toContain("Judge agreement with the exact rubric presentation and verdict identifiers provided by the user.");
    expect(prompt.user_prompt).toContain("<model_verdict>");
    expect(prompt.user_prompt).toContain("<scoring_mode>subset</scoring_mode>");
    expect(prompt.user_prompt).toContain("<scoring_mode_definition>Subset scoring semantics: multiple rubric stages may be selected at once.</scoring_mode_definition>");
    expect(prompt.user_prompt).toContain("<status>SCORED</status>");
    expect(prompt.user_prompt).toContain("<selected_identifiers>1PV7Cj, hIbjkx</selected_identifiers>");
    expect(prompt.user_prompt).toContain("Criteria:");
    expect(prompt.user_prompt).not.toContain("\"Minimal\"");
  });

  test("renders abstentions explicitly for score critic prompts", () => {
    const verdict = buildScoreCriticVerdictSummary({
      decoded_scores: [],
      displayed_identifiers_by_stage: ["A", "B"],
      method: "single",
    });

    const prompt = buildScoreCriticPrompt({
      config: {
        rubric_config: {
          scale_size: 2,
          concept: "fascism",
        },
        scoring_config: {
          method: "single",
          abstain_enabled: true,
          evidence_view: "l0_raw",
          randomizations: [],
          evidence_grouping: {
            mode: "single_evidence",
          },
        },
      },
      evidence: "Raw evidence.",
      rubric: {
        stages: [
          { label: "Minimal", criteria: ["a", "b", "c"] },
          { label: "Weak", criteria: ["a", "b", "c"] },
        ],
      },
      sample: {},
      verdict,
    });

    expect(verdict.status).toBe("abstain");
    expect(prompt.user_prompt).toContain("<scoring_mode>single</scoring_mode>");
    expect(prompt.user_prompt).toContain("<status>ABSTAIN</status>");
    expect(prompt.user_prompt).toContain("<selected_identifiers>(none)</selected_identifiers>");
  });
});
