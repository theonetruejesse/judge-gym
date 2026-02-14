import { describe, expect, test } from "bun:test";
import {
  parseRubricResponse,
  parseQualityResponse,
} from "../convex/domain/experiments/stages/rubric/rubric_parser";

describe("rubric_parser", () => {
  test("parseRubricResponse parses reasoning and stages", () => {
    const raw = `Reasoning text\nRUBRIC:\n1) Alpha :: one; two; three\n2) Beta :: four; five; six`;
    const result = parseRubricResponse(raw, 2);
    expect(result.reasoning).toBe("Reasoning text");
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0].label).toBe("Alpha");
  });

  test("parseQualityResponse parses QUALITY line", () => {
    const raw = `Reasoning\nQUALITY: observability=0.8, discriminability=0.6`;
    const result = parseQualityResponse(raw);
    expect(result.observabilityScore).toBeCloseTo(0.8, 5);
    expect(result.discriminabilityScore).toBeCloseTo(0.6, 5);
  });
});
