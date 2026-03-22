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

  test("does not over-split rubric criteria when semicolons appear inside parentheses", () => {
    const parsed = parseRubricResponse(
      [
        "I identified the concept to be evaluated as fascism.",
        "RUBRIC:",
        "1) Minimal or Indirect Signal :: Only vague labels or analogies (\"fascist\") without describing actions; General political conflict described with no distinctive ideological markers; No evidence of coordinated organization or state/institutional involvement",
        "2) Weak or Isolated Features :: A single quote or slogan hinting at ultranationalism or scapegoating; One-off intimidation incident reported without pattern or follow-through; Policies mentioned are generic law-and-order measures without targeting institutions or groups",
        "3) Suggestive Rhetoric with Limited Action :: Repeated nationalist or internal-enemy framing in speeches or communications; Small-scale organized rallies or groups referenced but limited reach; Early calls for stronger executive power without concrete structural changes",
        "4) Emerging Pattern and Organization :: Multiple instances of coordinated street mobilization or disciplined groups in the excerpt; Messaging emphasizes leader-centric unity and contempt for pluralism in more than one place; Initial institutional pressure appears (e.g., threats to media, NGOs, unions) but enforcement remains partial",
        "5) Ambiguous / Mixed Evidence :: Excerpt contains both pluralist and anti-pluralist signals from the same actors; Reported actions could plausibly fit several political styles (e.g., emergency measures with time limits and oversight); Evidence is fragmentary or disputed within the excerpt (competing accounts; unclear attribution; limited corroboration)",
        "6) Clear Anti-Pluralist Governance Moves :: Concrete steps to weaken checks and balances are described (court changes; electoral rule manipulation; legislating constraints on opposition); State resources are used to favor a ruling movement (patronage; selective enforcement; administrative obstacles); Targeted pressure on media, academia, civil society, or minorities is documented as policy or repeated practice",
        "7) Systematic Mobilization and Coercion :: Paramilitary-aligned or state-tolerated violence/intimidation is described as recurring and politically directional; Leader or party promotes a singular national identity and delegitimizes opponents as traitors or enemies with institutional consequences; Coordinated propaganda apparatus or centralized messaging is evident",
        "8) Institutionalized Suppression and One-Party Drift :: Opposition participation is materially constrained (bans; arrests; disqualification; severe harassment) in ways that shape outcomes; Legal or administrative systems are portrayed as subordinated to the ruling movement (politicized courts; purges; loyalty requirements); Mass organizations are integrated into state or party control (compulsory associations; corporatist structures; co-optation of labor or business representation)",
        "9) Overt, Comprehensive Fascist-Style Consolidation Signal :: Excerpt describes explicit embrace of fascist doctrine or symbols alongside governance actions; Coercion and surveillance are pervasive and coordinated across institutions with limited effective recourse; Political pluralism is functionally eliminated or near-eliminated in the described context",
      ].join("\n"),
      9,
    );

    expect(parsed.stages).toHaveLength(9);
    expect(parsed.stages[4]?.criteria).toHaveLength(3);
    expect(parsed.stages[5]?.criteria).toHaveLength(3);
    expect(parsed.stages[7]?.criteria).toHaveLength(3);
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

  test("accepts markdown-emphasized subset verdict lines", () => {
    const parsed = parseSubsetVerdict(
      [
        "Reasoning goes here.",
        "**VERDICT: ThKMhJ, vcPIJZ**",
      ].join("\n"),
      { ThKMhJ: 3, vcPIJZ: 2 },
    );

    expect(parsed.abstained).toBe(false);
    expect(parsed.rawVerdict).toBe("ThKMhJ, vcPIJZ");
    expect(parsed.decodedScores).toEqual([3, 2]);
  });

  test("extracts known subset labels even when the verdict line has extra punctuation", () => {
    const parsed = parseSubsetVerdict(
      [
        "Reasoning goes here.",
        "VERDICT: VcGZj, dqqCdj.",
      ].join("\n"),
      { VcGZj: 4, dqqCdj: 6 },
    );

    expect(parsed.abstained).toBe(false);
    expect(parsed.rawVerdict).toBe("VcGZj, dqqCdj");
    expect(parsed.decodedScores).toEqual([4, 6]);
  });
});
