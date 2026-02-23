export function parseRubricResponse(
  raw: string,
  scaleSize: number,
): {
  reasoning: string;
  stages: Array<{ stage_number: number; label: string; criteria: string[] }>;
} {
  const markerMatch = raw.match(/(?:^|\n)RUBRIC:\s*\n([\s\S]+)$/i);
  if (!markerMatch) {
    throw new Error(`Failed to find RUBRIC block: ${raw}`);
  }

  const rubricBlock = markerMatch[1].trim();
  const reasoning = raw.slice(0, markerMatch.index).trim();
  if (!reasoning) {
    throw new Error("Missing reasoning before RUBRIC block");
  }

  const lines = rubricBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const stages = lines.map((line, idx) => {
    const match = line.match(/^\s*\d+\)\s*(.+?)\s*::\s*(.+)$/);
    if (!match) {
      throw new Error(`Invalid rubric line: ${line}`);
    }
    const label = match[1].trim();
    const criteria = match[2]
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (criteria.length < 3 || criteria.length > 5) {
      throw new Error(
        `Invalid criteria count (${criteria.length}) for stage "${label}"`,
      );
    }
    return { stage_number: idx + 1, label, criteria };
  });

  if (stages.length !== scaleSize) {
    throw new Error(
      `Expected ${scaleSize} stages, received ${stages.length}`,
    );
  }

  return { reasoning, stages };
}

export function parseQualityResponse(raw: string): {
  observabilityScore: number;
  discriminabilityScore: number;
  reasoning: string;
} {
  const match = findLastQualityMatch(raw);
  const observabilityScore = Number(match.observability);
  const discriminabilityScore = Number(match.discriminability);

  if (Number.isNaN(observabilityScore) || Number.isNaN(discriminabilityScore)) {
    throw new Error(
      `Invalid QUALITY values: ${match.observability}, ${match.discriminability}`,
    );
  }

  return {
    observabilityScore: clamp01(observabilityScore),
    discriminabilityScore: clamp01(discriminabilityScore),
    reasoning: extractReasoningBeforeQuality(raw),
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function findLastQualityMatch(raw: string): {
  observability: string;
  discriminability: string;
  index: number;
} {
  const regex =
    /QUALITY:\s*observability\s*=\s*([01](?:\.\d+)?)\s*[,\s]+discriminability\s*=\s*([01](?:\.\d+)?)/gi;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  regex.lastIndex = 0;
  while ((match = regex.exec(raw)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) {
    throw new Error(`Failed to parse QUALITY line: ${raw}`);
  }
  return {
    observability: lastMatch[1],
    discriminability: lastMatch[2],
    index: lastMatch.index,
  };
}

export function extractReasoningBeforeQuality(raw: string): string {
  const { index } = findLastQualityMatch(raw);
  const reasoning = raw.slice(0, index).trim();
  if (!reasoning) {
    throw new Error("Missing reasoning before QUALITY line");
  }
  return reasoning;
}

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
    : normalized.charCodeAt(0) - 64;

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
  if (Number.isNaN(prob)) {
    throw new Error(`Invalid probability value parsed: ${lastMatch[1]}`);
  }
  const reasoning = raw.slice(0, lastMatch.index).trim();
  if (!reasoning) {
    throw new Error("Missing reasoning before EXPERT_AGREEMENT line");
  }
  const clamped = Math.min(1.0, Math.max(0.0, prob));
  return { expertAgreementProb: clamped, reasoning };
}
