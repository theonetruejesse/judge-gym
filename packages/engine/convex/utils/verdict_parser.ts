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
  if (!lineMatch) {
    throw new Error(`Failed to parse verdict line: ${raw}`);
  }

  const line = lineMatch[1].split("\n")[0].trim();
  if (line.toUpperCase() === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };

  const tokenMatch = line.match(/[A-Za-z0-9]+/);
  if (!tokenMatch) {
    throw new Error(`Failed to parse verdict token: ${line}`);
  }

  const token = tokenMatch[0];

  const normalized = token.toUpperCase();
  const decoded = labelMapping
    ? labelMapping[token]
    : normalized.charCodeAt(0) - 64; // fallback: A=1, B=2, ...

  if (decoded === undefined) {
    throw new Error(`Unrecognized verdict label: ${token}`);
  }

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
  if (!match) {
    throw new Error(`Failed to parse verdict line: ${raw}`);
  }

  const verdictLine = match[1].split("\n")[0].trim();
  if (verdictLine.toUpperCase() === "ABSTAIN")
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };

  const cleaned = verdictLine.replace(/[\[\]]/g, "");
  const tokens = cleaned
    .split(/[,\s/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    throw new Error(`Failed to parse verdict tokens: ${verdictLine}`);
  }
  const decoded: number[] = [];
  for (const token of tokens) {
    if (labelMapping) {
      const mapped = labelMapping[token];
      if (mapped === undefined) {
        throw new Error(`Unrecognized verdict label: ${token}`);
      }
      decoded.push(mapped);
      continue;
    }
    const normalized = token.toUpperCase();
    if (!/^[A-Z]$/.test(normalized)) {
      throw new Error(`Unrecognized verdict label: ${token}`);
    }
    decoded.push(normalized.charCodeAt(0) - 64);
  }

  return {
    rawVerdict: verdictLine,
    decodedScores: decoded.length > 0 ? decoded : null,
    abstained: false,
  };
}

export function parseJsonVerdict(
  raw: string,
  labelMapping?: Record<string, number>,
): {
  rawVerdict: string | null;
  decodedScores: number[] | null;
  abstained: boolean;
} {
  const match = raw.match(/VERDICT_JSON:\s*(\{.+\})/i);
  if (!match) {
    throw new Error(`Failed to parse VERDICT_JSON line: ${raw}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid VERDICT_JSON payload: ${match[1]}`);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("verdict" in parsed) ||
    typeof (parsed as { verdict: string }).verdict !== "string"
  ) {
    throw new Error(`VERDICT_JSON missing verdict field: ${match[1]}`);
  }

  const verdict = (parsed as { verdict: string }).verdict.trim();
  if (verdict.toUpperCase() === "ABSTAIN") {
    return { rawVerdict: "ABSTAIN", decodedScores: null, abstained: true };
  }

  const tokenMatch = verdict.match(/[A-Za-z0-9]+/);
  if (!tokenMatch) {
    throw new Error(`Failed to parse verdict token: ${verdict}`);
  }

  const token = tokenMatch[0];
  const normalized = token.toUpperCase();
  const decoded = labelMapping
    ? labelMapping[token]
    : normalized.charCodeAt(0) - 64;

  if (decoded === undefined) {
    throw new Error(`Unrecognized verdict label: ${token}`);
  }

  return { rawVerdict: token, decodedScores: [decoded], abstained: false };
}
