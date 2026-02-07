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
  const lineMatch = raw.match(/VERDICT:\s*(.+)/i);
  if (!lineMatch)
    return { rawVerdict: null, decodedScores: null, abstained: false };

  const line = lineMatch[1].split("\n")[0].trim();
  if (line.toUpperCase() === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };

  const tokenMatch = line.match(/[A-Za-z0-9]+/);
  if (!tokenMatch)
    return { rawVerdict: line, decodedScores: null, abstained: false };

  const token = tokenMatch[0];

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

  const verdictLine = match[1].split("\n")[0].trim();
  if (verdictLine.toUpperCase() === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };

  const cleaned = verdictLine.replace(/[\[\]]/g, "");
  const tokens = cleaned
    .split(/[,\s/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const decoded = tokens
    .map((t) => (labelMapping ? labelMapping[t] : t.charCodeAt(0) - 64))
    .filter((d): d is number => d !== undefined);

  return {
    rawVerdict: verdictLine,
    decodedScores: decoded.length > 0 ? decoded : null,
    abstained: false,
  };
}
