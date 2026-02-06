/**
 * Deterministic verdict parsers. No LLM, no DB.
 * Parse VERDICT: suffix from freeform text output.
 */

export function parseSingleVerdict(
  raw: string,
  labelMapping?: Record<string, number>,
): {
  rawVerdict: string | null;
  decodedScores: number[] | null;
  abstained: boolean;
} {
  const match = raw.match(/VERDICT:\s*([A-Z]+)/i);
  if (!match)
    return { rawVerdict: null, decodedScores: null, abstained: false };
  if (match[1] === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };
  const letter = match[1];
  const decoded = labelMapping
    ? labelMapping[letter]
    : letter.charCodeAt(0) - 64;
  return { rawVerdict: letter, decodedScores: [decoded], abstained: false };
}

export function parseSubsetVerdict(
  raw: string,
  labelMapping?: Record<string, number>,
): {
  rawVerdict: string | null;
  decodedScores: number[] | null;
  abstained: boolean;
} {
  const match = raw.match(/VERDICT:\s*(.+)/i);
  if (!match)
    return { rawVerdict: null, decodedScores: null, abstained: false };
  const verdict = match[1].trim();
  if (verdict === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };
  const letters = verdict.split(",").map((l) => l.trim());
  const decoded = letters.map((l) =>
    labelMapping ? labelMapping[l] : l.charCodeAt(0) - 64,
  );
  return { rawVerdict: verdict, decodedScores: decoded, abstained: false };
}
