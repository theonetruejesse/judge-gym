import { describe, expect, test } from "bun:test";
import {
  parseSingleVerdict,
  parseSubsetVerdict,
  parseJsonVerdict,
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

  test("parseSingleVerdict is case-insensitive", () => {
    const result = parseSingleVerdict("verdict: d");
    expect(result).toEqual({
      rawVerdict: "d",
      decodedScores: [4],
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

  test("parseSubsetVerdict rejects unknown labels", () => {
    const mapping = { abc123: 2 };
    expect(() => parseSubsetVerdict("VERDICT: abc123, nope", mapping)).toThrow();
  });

  test("parseSubsetVerdict handles slashes and spaces", () => {
    const result = parseSubsetVerdict("VERDICT: A / C");
    expect(result).toEqual({
      rawVerdict: "A / C",
      decodedScores: [1, 3],
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

  test("parseSingleVerdict throws on missing verdict line", () => {
    expect(() => parseSingleVerdict("No verdict here")).toThrow();
  });

  test("parseSingleVerdict throws on unknown label with mapping", () => {
    const mapping = { abc123: 1 };
    expect(() => parseSingleVerdict("VERDICT: nope", mapping)).toThrow();
  });

  test("parseSubsetVerdict throws on empty verdict", () => {
    expect(() => parseSubsetVerdict("VERDICT: []")).toThrow();
  });

  test("parseSubsetVerdict throws on abstain mismatch", () => {
    const result = parseSubsetVerdict("VERDICT: ABSTAIN");
    expect(result).toEqual({
      rawVerdict: "ABSTAIN",
      decodedScores: null,
      abstained: true,
    });
  });

  test("parseJsonVerdict parses verdict JSON", () => {
    const result = parseJsonVerdict(
      'Reasoning...\nVERDICT_JSON: {"verdict":"C"}',
    );
    expect(result).toEqual({
      rawVerdict: "C",
      decodedScores: [3],
      abstained: false,
    });
  });

  test("parseJsonVerdict handles abstain", () => {
    const result = parseJsonVerdict('VERDICT_JSON: {"verdict":"ABSTAIN"}');
    expect(result).toEqual({
      rawVerdict: "ABSTAIN",
      decodedScores: null,
      abstained: true,
    });
  });

  test("parseJsonVerdict supports label mappings", () => {
    const mapping = { x1Y2z3: 4 };
    const result = parseJsonVerdict(
      'VERDICT_JSON: {"verdict":"x1Y2z3"}',
      mapping,
    );
    expect(result).toEqual({
      rawVerdict: "x1Y2z3",
      decodedScores: [4],
      abstained: false,
    });
  });

  test("parseJsonVerdict throws on invalid payload", () => {
    expect(() => parseJsonVerdict("VERDICT_JSON: {bad}")).toThrow();
  });

  test("parseJsonVerdict throws on missing verdict field", () => {
    expect(() => parseJsonVerdict('VERDICT_JSON: {"nope":1}')).toThrow();
  });
});
