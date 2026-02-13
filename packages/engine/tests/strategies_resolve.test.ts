import { describe, expect, test } from "bun:test";
import { resolveAll } from "../convex/domain/experiments/strategies/resolve";
import { resolveEvidenceStrategy } from "../convex/domain/experiments/strategies/evidence.strategy";
import { resolveRandomizationStrategy } from "../convex/domain/experiments/strategies/randomization.strategy";
import type { ExperimentConfig } from "../convex/models/core";

const config: ExperimentConfig = {
  scale_size: 5,
  randomizations: ["anon-label", "rubric-order-shuffle"],
  evidence_view: "raw",
  scoring_method: "freeform-suffix-subset",
  prompt_ordering: "evidence-first",
  abstain_enabled: true,
};

describe("strategies resolve", () => {
  test("resolveAll maps config to concrete strategies", () => {
    const resolved = resolveAll(config);

    expect(resolved.scale.stageCount).toBe(5);
    expect(resolved.scale.hasMidpoint).toBe(true);
    expect(resolved.scale.midpointLabel).toBe("C");
    expect(resolved.evidence.contentField).toBe("raw_content");
    expect(resolved.ordering.rubricFirst).toBe(false);
    expect(resolved.randomization.anonLabel).toBe(true);
    expect(resolved.randomization.rubricOrderShuffle).toBe(true);
    expect(resolved.randomization.hideLabelName).toBe(false);
    expect(typeof resolved.scoring.parseVerdict).toBe("function");
    expect(resolved.scoring.buildPromptSuffix(["A", "B"]))
      .toContain("A, B");
  });

  test("resolveEvidenceStrategy maps evidence_view to content field", () => {
    expect(resolveEvidenceStrategy({ ...config, evidence_view: "raw" }))
      .toEqual({ contentField: "raw_content" });
    expect(resolveEvidenceStrategy({ ...config, evidence_view: "cleaned" }))
      .toEqual({ contentField: "cleaned_content" });
    expect(resolveEvidenceStrategy({ ...config, evidence_view: "neutralized" }))
      .toEqual({ contentField: "neutralized_content" });
    expect(resolveEvidenceStrategy({ ...config, evidence_view: "abstracted" }))
      .toEqual({ contentField: "abstracted_content" });
  });

  test("resolveRandomizationStrategy maps flags", () => {
    const strategy = resolveRandomizationStrategy({
      ...config,
      randomizations: ["anon-label", "rubric-order-shuffle"],
    });
    expect(strategy.anonLabel).toBe(true);
    expect(strategy.rubricOrderShuffle).toBe(true);
    expect(strategy.hideLabelName).toBe(false);
  });
});
