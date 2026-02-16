import { describe, expect, test } from "bun:test";
import { resolveAll } from "../convex/domain/experiments/strategies/experiments_resolve";
import { resolveEvidenceStrategy } from "../convex/domain/experiments/strategies/experiments_evidence.strategy";
import { resolveRandomizationStrategy } from "../convex/domain/experiments/strategies/experiments_randomization.strategy";
import type { ExperimentConfig } from "../convex/models/core";

const config: ExperimentConfig = {
  rubric_stage: {
    scale_size: 5,
    model_id: "gpt-4.1",
  },
  scoring_stage: {
    model_id: "gpt-4.1",
    method: "subset",
    randomizations: ["anonymize_labels", "shuffle_rubric_order"],
    evidence_view: "l0_raw",
    abstain_enabled: true,
  },
};

describe("strategies resolve", () => {
  test("resolveAll maps config to concrete strategies", () => {
    const resolved = resolveAll(config);

    expect(resolved.scale.stageCount).toBe(5);
    expect(resolved.scale.hasMidpoint).toBe(true);
    expect(resolved.scale.midpointLabel).toBe("C");
    expect(resolved.evidence.contentField).toBe("raw_content");
    expect(resolved.randomization.anonLabel).toBe(true);
    expect(resolved.randomization.rubricOrderShuffle).toBe(true);
    expect(resolved.randomization.hideLabelName).toBe(false);
    expect(typeof resolved.scoring.parseVerdict).toBe("function");
    expect(resolved.scoring.buildPromptSuffix(["A", "B"]))
      .toContain("A, B");
  });

  test("resolveEvidenceStrategy maps evidence_view to content field", () => {
    expect(
      resolveEvidenceStrategy({
        ...config,
        scoring_stage: { ...config.scoring_stage, evidence_view: "l0_raw" },
      }),
    ).toEqual({ contentField: "raw_content" });
    expect(
      resolveEvidenceStrategy({
        ...config,
        scoring_stage: { ...config.scoring_stage, evidence_view: "l1_cleaned" },
      }),
    ).toEqual({ contentField: "cleaned_content" });
    expect(
      resolveEvidenceStrategy({
        ...config,
        scoring_stage: {
          ...config.scoring_stage,
          evidence_view: "l2_neutralized",
        },
      }),
    ).toEqual({ contentField: "neutralized_content" });
    expect(
      resolveEvidenceStrategy({
        ...config,
        scoring_stage: {
          ...config.scoring_stage,
          evidence_view: "l3_abstracted",
        },
      }),
    ).toEqual({ contentField: "abstracted_content" });
  });

  test("resolveRandomizationStrategy maps flags", () => {
    const strategy = resolveRandomizationStrategy({
      ...config,
      scoring_stage: {
        ...config.scoring_stage,
        randomizations: ["anonymize_labels", "shuffle_rubric_order"],
      },
    });
    expect(strategy.anonLabel).toBe(true);
    expect(strategy.rubricOrderShuffle).toBe(true);
    expect(strategy.hideLabelName).toBe(false);
  });
});
