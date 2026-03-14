import { describe, expect, test } from "vitest";
import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../domain/runs/run_parsers";

describe("run verdict parsers", () => {
  test("normalizes repeated VERDICT prefixes for single verdicts", () => {
    const parsed = parseSingleVerdict(
      [
        "Step 1: Compare the evidence against the rubric.",
        "VERDICT: VERDICT: QBIqOe",
      ].join("\n"),
      { QBIqOe: 1 },
    );

    expect(parsed.abstained).toBe(false);
    expect(parsed.rawVerdict).toBe("QBIqOe");
    expect(parsed.decodedScores).toEqual([1]);
  });

  test("normalizes subset verdict lines before decoding", () => {
    const parsed = parseSubsetVerdict(
      [
        "Step 1: Evaluate the displayed identifiers only.",
        "VERDICT: `VERDICT: 3ClBYt,Tdqasf`",
      ].join("\n"),
      { "3ClBYt": 2, Tdqasf: 4 },
    );

    expect(parsed.abstained).toBe(false);
    expect(parsed.rawVerdict).toBe("3ClBYt,Tdqasf");
    expect(parsed.decodedScores).toEqual([2, 4]);
  });
});
