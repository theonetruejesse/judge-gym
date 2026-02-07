import { describe, expect, test } from "bun:test";
import {
  parseRubricResponse,
  parseQualityResponse,
} from "../convex/utils/rubric_parser";

describe("rubric_parser", () => {
  test("parseRubricResponse parses reasoning and stages", () => {
    const raw = `
Reasoning text about the scale.

RUBRIC:
1) Stage One :: criterion a; criterion b; criterion c
2) Stage Two :: criterion d; criterion e; criterion f
3) Stage Three :: criterion g; criterion h; criterion i
`;

    const result = parseRubricResponse(raw, 3);
    expect(result.reasoning).toContain("Reasoning text");
    expect(result.stages).toEqual([
      {
        label: "Stage One",
        criteria: ["criterion a", "criterion b", "criterion c"],
      },
      {
        label: "Stage Two",
        criteria: ["criterion d", "criterion e", "criterion f"],
      },
      {
        label: "Stage Three",
        criteria: ["criterion g", "criterion h", "criterion i"],
      },
    ]);
  });

  test("parseRubricResponse rejects missing rubric block", () => {
    expect(() => parseRubricResponse("No rubric here", 3)).toThrow();
  });

  test("parseRubricResponse tolerates extra whitespace", () => {
    const raw = `
Reasoning.

RUBRIC:
  1)   Stage One   ::  criterion a ;  criterion b ; criterion c

  2) Stage Two :: criterion d; criterion e; criterion f
  3) Stage Three :: criterion g; criterion h; criterion i
`;
    const result = parseRubricResponse(raw, 3);
    expect(result.stages[0]).toEqual({
      label: "Stage One",
      criteria: ["criterion a", "criterion b", "criterion c"],
    });
  });

  test("parseRubricResponse rejects wrong stage count", () => {
    const raw = `
Reasoning.

RUBRIC:
1) Stage One :: criterion a; criterion b; criterion c
2) Stage Two :: criterion d; criterion e; criterion f
`;
    expect(() => parseRubricResponse(raw, 3)).toThrow();
  });

  test("parseRubricResponse rejects invalid line format", () => {
    const raw = `
Reasoning.

RUBRIC:
Stage One :: criterion a; criterion b; criterion c
`;
    expect(() => parseRubricResponse(raw, 1)).toThrow();
  });

  test("parseRubricResponse rejects missing reasoning", () => {
    const raw = `
RUBRIC:
1) Stage One :: criterion a; criterion b; criterion c
`;
    expect(() => parseRubricResponse(raw, 1)).toThrow();
  });

  test("parseRubricResponse rejects invalid criteria counts", () => {
    const raw = `
Reasoning.

RUBRIC:
1) Stage One :: criterion a; criterion b
2) Stage Two :: criterion c; criterion d; criterion e
`;
    expect(() => parseRubricResponse(raw, 2)).toThrow();
  });

  test("parseRubricResponse rejects empty criteria tokens", () => {
    const raw = `
Reasoning.

RUBRIC:
1) Stage One :: criterion a; ; criterion c
`;
    expect(() => parseRubricResponse(raw, 1)).toThrow();
  });

  test("parseQualityResponse parses quality line", () => {
    const result = parseQualityResponse(
      "QUALITY: observability=0.8 discriminability=0.6",
    );
    expect(result).toEqual({
      observabilityScore: 0.8,
      discriminabilityScore: 0.6,
    });
  });

  test("parseQualityResponse is case-insensitive", () => {
    const result = parseQualityResponse(
      "quality: observability=0.9 discriminability=0.1",
    );
    expect(result).toEqual({
      observabilityScore: 0.9,
      discriminabilityScore: 0.1,
    });
  });

  test("parseQualityResponse rejects invalid quality", () => {
    expect(() => parseQualityResponse("QUALITY: oops")).toThrow();
  });
});
