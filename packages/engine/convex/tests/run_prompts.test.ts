import { describe, expect, test } from "vitest";
import {
  buildRubricCriticPrompt,
  buildRubricGenPrompt,
  buildScoreCriticPrompt,
  buildScoreCriticVerdictSummary,
  buildScoreGenPrompt,
} from "../domain/runs/run_prompts";

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
    expect(prompt.user_prompt).toContain("<prompt_variables>");
    expect(prompt.user_prompt).toContain("<concept>fascism</concept>");
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
    expect(prompt.system_prompt).toContain("Select every rubric stage identifier whose criteria are affirmatively supported by the evidence.");
    expect(prompt.system_prompt).toContain("End with exactly one final line in one of these forms:");
    expect(prompt.system_prompt).toContain("`VERDICT: <comma-separated IDs from: A, B, C, D>`");
    expect(prompt.system_prompt).toContain("`VERDICT: ABSTAIN`");
    expect(prompt.user_prompt).toContain("<rubric_stages>");
    expect(prompt.user_prompt).toContain("A: \"Minimal\" - Criteria: a; b; c");
    expect(prompt.label_tokens).toEqual(["A", "B", "C", "D"]);
  });

  test("builds score critic verdict summaries from decoded stages", () => {
    const verdict = buildScoreCriticVerdictSummary({
      decoded_scores: [4, 2, 4],
      rubric_stages: [
        { label: "Minimal", criteria: ["a", "b", "c"] },
        { label: "Weak", criteria: ["a", "b", "c"] },
        { label: "Clear", criteria: ["a", "b", "c"] },
        { label: "Extensive", criteria: ["a", "b", "c"] },
      ],
      method: "subset",
      justification: "The evidence supports multiple stages.",
    });

    expect(verdict).toEqual({
      method: "subset",
      status: "scored",
      selected_stages: [2, 4],
      selected_labels: ["Weak", "Extensive"],
      justification: "The evidence supports multiple stages.",
    });
  });

  test("renders score critic prompts with decoded verdict details", () => {
    const prompt = buildScoreCriticPrompt({
      evidence: "Neutralized Summary:\nInstitutional pressure escalated.",
      rubric: [
        { label: "Minimal", criteria: ["a", "b", "c"] },
        { label: "Weak", criteria: ["a", "b", "c"] },
        { label: "Clear", criteria: ["a", "b", "c"] },
        { label: "Extensive", criteria: ["a", "b", "c"] },
      ],
      verdict: {
        method: "subset",
        status: "scored",
        selected_stages: [2, 4],
        selected_labels: ["Weak", "Extensive"],
        justification: "The evidence supports multiple stages.",
      },
    });

    expect(prompt.system_prompt).toContain("<evidence>");
    expect(prompt.system_prompt).toContain("Do not rely on hidden IDs, opaque identifiers, or alternative label schemes.");
    expect(prompt.user_prompt).toContain("<model_verdict>");
    expect(prompt.user_prompt).toContain("<scoring_mode>subset</scoring_mode>");
    expect(prompt.user_prompt).toContain("<scoring_mode_definition>Subset scoring semantics: multiple rubric stages may be selected at once.</scoring_mode_definition>");
    expect(prompt.user_prompt).toContain("<status>SCORED</status>");
    expect(prompt.user_prompt).toContain("<selected_stages>2, 4</selected_stages>");
    expect(prompt.user_prompt).toContain("<selected_labels>Weak | Extensive</selected_labels>");
    expect(prompt.user_prompt).toContain("<justification>The evidence supports multiple stages.</justification>");
  });

  test("renders abstentions explicitly for score critic prompts", () => {
    const verdict = buildScoreCriticVerdictSummary({
      decoded_scores: [],
      rubric_stages: [
        { label: "Minimal", criteria: ["a", "b", "c"] },
        { label: "Weak", criteria: ["a", "b", "c"] },
      ],
      method: "single",
      justification: "No stage is sufficiently supported.",
    });

    const prompt = buildScoreCriticPrompt({
      evidence: "Raw evidence.",
      rubric: [
        { label: "Minimal", criteria: ["a", "b", "c"] },
        { label: "Weak", criteria: ["a", "b", "c"] },
      ],
      verdict,
    });

    expect(verdict.status).toBe("abstain");
    expect(prompt.user_prompt).toContain("<scoring_mode>single</scoring_mode>");
    expect(prompt.user_prompt).toContain("<status>ABSTAIN</status>");
    expect(prompt.user_prompt).toContain("<selected_stages>(none)</selected_stages>");
    expect(prompt.user_prompt).toContain("<selected_labels>(none)</selected_labels>");
  });
});
