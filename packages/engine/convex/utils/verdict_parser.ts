/**
 * Deterministic verdict parsers. No LLM, no DB.
 * Parse VERDICT: suffix from freeform text output.
 *
 * Labels may be single letters (A–D) or 6-char nanoid identifiers.
 * Both formats are handled by the same parsers.
 */

export function parseSingleVerdict(
  raw: string,
  labelMapping?: Record<string, number>,
): {
  rawVerdict: string | null;
  decodedScores: number[] | null;
  abstained: boolean;
} {
  // Match alphanumeric token (letters or nanoid IDs)
  const match = raw.match(/VERDICT:\s*([A-Za-z0-9]+)/i);
  if (!match)
    return { rawVerdict: null, decodedScores: null, abstained: false };

  const token = match[1];
  if (token.toUpperCase() === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };

  const decoded = labelMapping
    ? labelMapping[token]
    : token.charCodeAt(0) - 64; // fallback: A=1, B=2, ...

  if (decoded === undefined)
    return { rawVerdict: token, decodedScores: null, abstained: false };

  return { rawVerdict: token, decodedScores: [decoded], abstained: false };
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
  if (verdict.toUpperCase() === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };

  const tokens = verdict.split(",").map((t) => t.trim());
  const decoded = tokens
    .map((t) => (labelMapping ? labelMapping[t] : t.charCodeAt(0) - 64))
    .filter((d): d is number => d !== undefined);

  return {
    rawVerdict: verdict,
    decodedScores: decoded.length > 0 ? decoded : null,
    abstained: false,
  };
}
