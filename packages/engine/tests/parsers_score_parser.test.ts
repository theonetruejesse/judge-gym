import { describe, expect, test } from "bun:test";
import {
  parseSingleVerdict,
  parseSubsetVerdict,
  parseExpertAgreementResponse,
} from "../convex/domain/experiments/stages/scoring/parsers/score_parser";

describe("score_parser", () => {
  test("parseSingleVerdict parses single label", () => {
    const result = parseSingleVerdict("Reasoning\nVERDICT: B");
    expect(result.rawVerdict).toBe("B");
    expect(result.decodedScores).toEqual([2]);
    expect(result.abstained).toBe(false);
  });

  test("parseSingleVerdict handles abstain", () => {
    const result = parseSingleVerdict("Reasoning\nVERDICT: ABSTAIN");
    expect(result.abstained).toBe(true);
  });

  test("parseSubsetVerdict parses subset", () => {
    const result = parseSubsetVerdict("Reasoning\nVERDICT: A, C");
    expect(result.decodedScores).toEqual([1, 3]);
  });

  test("parseExpertAgreementResponse parses probability", () => {
    const result = parseExpertAgreementResponse(
      "Because...\nEXPERT_AGREEMENT: 0.72",
    );
    expect(result.expertAgreementProb).toBeCloseTo(0.72, 5);
    expect(result.reasoning).toContain("Because");
  });
});
