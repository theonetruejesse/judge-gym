import { describe, expect, test } from "bun:test";
import { buildScoreGenPrompt } from "../convex/domain/experiments/stages/scoring/scoring_prompts";
import { buildRubricGenPrompt } from "../convex/domain/experiments/stages/rubric/rubric_prompts";
import type { ExperimentConfig } from "../convex/models/core";

const baseConfig: ExperimentConfig = {
  rubric_stage: {
    scale_size: 2,
    model_id: "gpt-4.1",
  },
  scoring_stage: {
    model_id: "gpt-4.1",
    method: "single",
    randomizations: [],
    evidence_view: "l0_raw",
    abstain_enabled: true,
  },
};

describe("prompts", () => {
  test("buildRubricGenPrompt includes RUBRIC block", () => {
    const prompt = buildRubricGenPrompt({
      concept: "fascism",
      scale_size: 2,
      config: baseConfig,
    });
    expect(prompt.user_prompt).toContain("RUBRIC:");
  });

  test("buildScoreGenPrompt includes labels", () => {
    const prompt = buildScoreGenPrompt({
      config: baseConfig,
      evidence: { raw_content: "Evidence" },
      rubric: {
        stages: [
          { label: "Low", criteria: ["a", "b", "c"] },
          { label: "High", criteria: ["d", "e", "f"] },
        ],
      },
      sample: {},
    });
    expect(prompt.user_prompt).toContain("RUBRIC STAGES");
    expect(prompt.user_prompt).toContain("VERDICT:");
    expect(prompt.user_prompt).toContain("A:");
  });

  test("buildScoreGenPrompt uses anon labels when provided", () => {
    const prompt = buildScoreGenPrompt({
      config: {
        ...baseConfig,
        scoring_stage: {
          ...baseConfig.scoring_stage,
          randomizations: ["anonymize_labels"],
        },
      },
      evidence: { raw_content: "Evidence" },
      rubric: {
        stages: [
          { label: "Low", criteria: ["a", "b", "c"] },
          { label: "High", criteria: ["d", "e", "f"] },
        ],
      },
      sample: {
        label_mapping: { X1Y2Z3: 1, Q9W8E7: 2 },
      },
    });
    expect(prompt.user_prompt).toContain("X1Y2Z3");
    expect(prompt.user_prompt).toContain("Q9W8E7");
  });
});
