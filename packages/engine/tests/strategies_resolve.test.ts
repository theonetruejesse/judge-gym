import { describe, expect, test } from "bun:test";
import { resolveAll } from "../convex/strategies/resolve";
import { resolveEvidenceStrategy } from "../convex/strategies/evidence.strategy";
import { resolveRandomizationStrategy } from "../convex/strategies/randomization.strategy";
import type { ExperimentConfig } from "../convex/schema";

const config: ExperimentConfig = {
  scaleSize: 5,
  randomizations: ["anon-label", "rubric-order-shuffle"],
  evidenceView: "raw",
  scoringMethod: "freeform-suffix-subset",
  promptOrdering: "evidence-first",
  abstainEnabled: true,
};

describe("strategies resolve", () => {
  test("resolveAll maps config to concrete strategies", () => {
    const resolved = resolveAll(config);

    expect(resolved.scale.stageCount).toBe(5);
    expect(resolved.scale.hasMidpoint).toBe(true);
    expect(resolved.scale.midpointLabel).toBe("C");
    expect(resolved.evidence.contentField).toBe("rawContent");
    expect(resolved.ordering.rubricFirst).toBe(false);
    expect(resolved.randomization.anonLabel).toBe(true);
    expect(resolved.randomization.rubricOrderShuffle).toBe(true);
    expect(resolved.randomization.hideLabelName).toBe(false);
    expect(typeof resolved.scoring.parseVerdict).toBe("function");
    expect(resolved.scoring.buildPromptSuffix(["A", "B"]))
      .toContain("A, B");
  });

  test("resolveEvidenceStrategy maps evidenceView to content field", () => {
    expect(resolveEvidenceStrategy({ ...config, evidenceView: "raw" }))
      .toEqual({ contentField: "rawContent" });
    expect(resolveEvidenceStrategy({ ...config, evidenceView: "cleaned" }))
      .toEqual({ contentField: "cleanedContent" });
    expect(resolveEvidenceStrategy({ ...config, evidenceView: "neutralized" }))
      .toEqual({ contentField: "neutralizedContent" });
    expect(resolveEvidenceStrategy({ ...config, evidenceView: "abstracted" }))
      .toEqual({ contentField: "abstractedContent" });
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
