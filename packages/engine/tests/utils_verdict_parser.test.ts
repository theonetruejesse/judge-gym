import { describe, expect, test } from "bun:test";
import {
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../convex/utils/verdict_parser";

describe("verdict_parser", () => {
  test("parseSingleVerdict decodes letter verdicts", () => {
    const result = parseSingleVerdict("Reasoning...\nVERDICT: A");
    expect(result).toEqual({
      rawVerdict: "A",
      decodedScores: [1],
      abstained: false,
    });
  });

  test("parseSingleVerdict supports label mappings", () => {
    const mapping = { x1Y2z3: 3 };
    const result = parseSingleVerdict("VERDICT: x1Y2z3", mapping);
    expect(result).toEqual({
      rawVerdict: "x1Y2z3",
      decodedScores: [3],
      abstained: false,
    });
  });

  test("parseSingleVerdict handles abstain", () => {
    const result = parseSingleVerdict("VERDICT: ABSTAIN");
    expect(result).toEqual({
      rawVerdict: "ABSTAIN",
      decodedScores: null,
      abstained: true,
    });
  });

  test("parseSingleVerdict tolerates brackets and punctuation", () => {
    const result = parseSingleVerdict("VERDICT: [B].");
    expect(result).toEqual({
      rawVerdict: "B",
      decodedScores: [2],
      abstained: false,
    });
  });

  test("parseSingleVerdict ignores trailing content after verdict line", () => {
    const result = parseSingleVerdict("VERDICT: C\nBecause...");
    expect(result).toEqual({
      rawVerdict: "C",
      decodedScores: [3],
      abstained: false,
    });
  });

  test("parseSubsetVerdict decodes multiple letters", () => {
    const result = parseSubsetVerdict("VERDICT: B, D");
    expect(result).toEqual({
      rawVerdict: "B, D",
      decodedScores: [2, 4],
      abstained: false,
    });
  });

  test("parseSubsetVerdict ignores unknown labels", () => {
    const mapping = { abc123: 2 };
    const result = parseSubsetVerdict("VERDICT: abc123, nope", mapping);
    expect(result).toEqual({
      rawVerdict: "abc123, nope",
      decodedScores: [2],
      abstained: false,
    });
  });

  test("parseSubsetVerdict tolerates brackets, slashes, and extra lines", () => {
    const result = parseSubsetVerdict("VERDICT: [A / D]\nMore text");
    expect(result).toEqual({
      rawVerdict: "[A / D]",
      decodedScores: [1, 4],
      abstained: false,
    });
  });
});
