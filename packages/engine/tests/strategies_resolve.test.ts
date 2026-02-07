import { describe, expect, test } from "bun:test";
import { resolveAll } from "../convex/strategies/resolve";
import type { ExperimentConfig } from "../convex/schema";

describe("strategies resolve", () => {
  test("resolveAll maps config to concrete strategies", () => {
    const config: ExperimentConfig = {
      scaleSize: 5,
      randomizeLabels: true,
      neutralizeEvidence: false,
      scoringMethod: "freeform-suffix-subset",
      promptOrdering: "evidence-first",
      abstainEnabled: true,
      freshWindowProbe: false,
    };

    const resolved = resolveAll(config);

    expect(resolved.scale.stageCount).toBe(5);
    expect(resolved.scale.hasMidpoint).toBe(true);
    expect(resolved.scale.midpointLabel).toBe("C");
    expect(resolved.evidence.neutralize).toBe(false);
    expect(resolved.evidence.contentField).toBe("rawContent");
    expect(resolved.ordering.rubricFirst).toBe(false);
    expect(resolved.probe.freshWindow).toBe(false);
    expect(resolved.probe.recentMessages).toBe(10);
    expect(resolved.scoring.useGenerateObject).toBe(false);
    expect(resolved.scoring.buildPromptSuffix(["A", "B"]))
      .toContain("A,B");
  });
});
