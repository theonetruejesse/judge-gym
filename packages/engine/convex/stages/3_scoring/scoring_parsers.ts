/**
 * Deterministic verdict parsers. No LLM, no DB.
 * Parse VERDICT: suffix from freeform text output.
 *
 * Labels may be single letters (A–D) or 6-char nanoid identifiers.
 * Both formats are handled by the same parsers.
 */

const VERDICT_REGEX = /VERDICT:\s*(.+)/gi;

function getLastVerdictMatch(raw: string): { line: string; index: number } {
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  VERDICT_REGEX.lastIndex = 0;
  while ((match = VERDICT_REGEX.exec(raw)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) {
    throw new Error(`Failed to parse verdict line: ${raw}`);
  }
  const line = lastMatch[1].split("\n")[0].trim();
  return { line, index: lastMatch.index };
}

export function extractReasoningBeforeVerdict(raw: string): string {
  const { index } = getLastVerdictMatch(raw);
  const reasoning = raw.slice(0, index).trim();
  if (!reasoning) {
    throw new Error("Missing reasoning before VERDICT line");
  }
  return reasoning;
}

export function parseSingleVerdict(
  raw: string,
  labelMapping?: Record<string, number>,
): {
  rawVerdict: string | null;
  decodedScores: number[] | null;
  abstained: boolean;
} {
  const { line } = getLastVerdictMatch(raw);
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
  const { line: verdictLine } = getLastVerdictMatch(raw);
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
  let unknownToken = false;
  for (const token of tokens) {
    if (labelMapping) {
      const mapped = labelMapping[token];
      if (mapped !== undefined) {
        decoded.push(mapped);
      } else {
        unknownToken = true;
      }
      continue;
    }
    const normalized = token.toUpperCase();
    if (/^[A-Z]$/.test(normalized)) {
      decoded.push(normalized.charCodeAt(0) - 64);
    }
  }

  if (labelMapping && unknownToken) {
    throw new Error(`Unrecognized verdict label: ${verdictLine}`);
  }

  if (decoded.length === 0) {
    throw new Error(`Unrecognized verdict label: ${verdictLine}`);
  }

  return {
    rawVerdict: verdictLine,
    decodedScores: decoded.length > 0 ? decoded : null,
    abstained: false,
  };
}

export function parseExpertAgreementResponse(raw: string): {
  expertAgreementProb: number;
  reasoning: string;
} {
  const regex = /EXPERT_AGREEMENT:\s*([01](?:\.\d+)?)/gi;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  regex.lastIndex = 0;
  while ((match = regex.exec(raw)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) {
    throw new Error(
      `Failed to parse EXPERT_AGREEMENT line from probe response: ${raw}`,
    );
  }
  const prob = parseFloat(lastMatch[1]);
  if (isNaN(prob)) {
    throw new Error(`Invalid probability value parsed: ${lastMatch[1]}`);
  }
  const reasoning = raw.slice(0, lastMatch.index).trim();
  if (!reasoning) {
    throw new Error("Missing reasoning before EXPERT_AGREEMENT line");
  }
  const clamped = Math.min(1.0, Math.max(0.0, prob));
  return { expertAgreementProb: clamped, reasoning };
}
