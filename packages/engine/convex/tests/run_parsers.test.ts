import { describe, expect, test } from "vitest";
import {
  parseRubricResponse,
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../domain/runs/run_parsers";

describe("run parsers", () => {
  test("parses rubric stages when the model uses comma-expanded criteria inside a stage", () => {
    const parsed = parseRubricResponse(
      [
        "Step 1: Use only observable signals.",
        "RUBRIC:",
        "1) Minimal or Indirect Signal :: Mentions nationalist or authoritarian ideas in vague or passing terms; No explicit references to suppression or control; Lacks concrete actions or institutional evidence",
        "2) Weak or Isolated Features :: Describes some authoritarian behavior or nationalist rhetoric without broader systemic context; Limited or ambiguous accounts of repression or institutional influence; Policies or actions mentioned are inconsistent or partial",
        "3) Clear but Limited Pattern :: Provides multiple indicators consistent with fascism, such as explicit authoritarian leadership claims, some suppression of dissent, or institutional alignment; Evidence is partial or lacks breadth across key fascist traits; Some direct quotes or policies support concept",
        "4) Extensive or Overt Signal :: Text details a comprehensive pattern including strong authoritarian control, systematic suppression of opposition, explicit nationalist ideology, significant institutional domination, and aggressive policies aligned with fascist principles; Clear and repeated claims or actions support concept",
      ].join("\n"),
      4,
    );

    expect(parsed.stages).toHaveLength(4);
    expect(parsed.stages[2]?.criteria).toHaveLength(3);
    expect(parsed.stages[3]?.criteria).toHaveLength(6);
  });

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

  test("accepts bullet-prefixed verdict lines for single verdicts", () => {
    const parsed = parseSingleVerdict(
      [
        "Step 1: Compare the evidence against the rubric.",
        "- VERDICT: QBIqOe",
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

  test("accepts bullet-prefixed verdict lines for subset verdicts", () => {
    const parsed = parseSubsetVerdict(
      [
        "Step 1: Evaluate the displayed identifiers only.",
        "- VERDICT: 3ClBYt,Tdqasf",
      ].join("\n"),
      { "3ClBYt": 2, Tdqasf: 4 },
    );

    expect(parsed.abstained).toBe(false);
    expect(parsed.rawVerdict).toBe("3ClBYt,Tdqasf");
    expect(parsed.decodedScores).toEqual([2, 4]);
  });
});
