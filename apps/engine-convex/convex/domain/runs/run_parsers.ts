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
    .filter((line) => line !== "```")
    .filter((line) => line.length > 0);

  const stageLines = lines.filter((line) => /^\d+\)\s*/.test(line));
  const nonStageLines = lines.filter((line) => !/^\d+\)\s*/.test(line));
  if (nonStageLines.length > 0) {
    throw new Error(`Invalid rubric line: ${nonStageLines[0]}`);
  }

  const stages = stageLines.map((line, idx) => {
    const match = line.match(/^\s*\d+\)\s*(.+?)\s*::\s*(.+)$/);
    if (!match) {
      throw new Error(`Invalid rubric line: ${line}`);
    }
    const label = match[1].trim();
    const criteria = parseRubricCriteria(match[2]);
    if (criteria.length < 3 || criteria.length > 6) {
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

function parseRubricCriteria(rawCriteria: string): string[] {
  const semicolonSegments = splitTopLevel(rawCriteria, ";")
    .map((criterion) => normalizeCriterion(criterion))
    .filter((criterion) => criterion.length > 0);

  if (semicolonSegments.length >= 3 && semicolonSegments.length <= 5) {
    return semicolonSegments;
  }

  if (semicolonSegments.length >= 3) {
    return semicolonSegments;
  }

  const commaExpanded = semicolonSegments
    .flatMap((criterion) => splitCriterionOnComma(criterion))
    .map((criterion) => normalizeCriterion(criterion))
    .filter((criterion) => criterion.length > 0);

  if (commaExpanded.length >= 3 && commaExpanded.length <= 6) {
    return commaExpanded;
  }

  return semicolonSegments;
}

function splitCriterionOnComma(criterion: string): string[] {
  return splitTopLevel(criterion, ",")
    .map((part) => normalizeCriterion(part))
    .filter((part) => part.length > 0);
}

function splitTopLevel(raw: string, delimiter: ";" | ","): string[] {
  const segments: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  for (const char of raw) {
    if (char === "(") parenDepth += 1;
    if (char === ")" && parenDepth > 0) parenDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]" && bracketDepth > 0) bracketDepth -= 1;

    if (char === delimiter && parenDepth === 0 && bracketDepth === 0) {
      segments.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function normalizeCriterion(rawCriterion: string): string {
  return rawCriterion
    .trim()
    .replace(/^(?:and|or)\s+/i, "")
    .trim();
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

function normalizeVerdictLine(line: string): string {
  let normalized = line.trim();
  normalized = normalized.replace(/^[-*]\s*/, "");
  normalized = normalized.replace(/^\*\*+/, "");
  normalized = normalized.replace(/\*\*+$/g, "");
  normalized = normalized.replace(/^`+|`+$/g, "");
  normalized = normalized.replace(/^[:\s-]+/, "");
  normalized = normalized.replace(/^VERDICT:\s*/i, "");
  normalized = normalized.replace(/^VERDICT:\s*/i, "");
  normalized = normalized.replace(/^["']|["']$/g, "");
  normalized = normalized.replace(/[.;]+$/g, "");
  return normalized.trim();
}

function normalizeVerdictToken(token: string): string {
  return token
    .trim()
    .replace(/^[-*]\s*/, "")
    .replace(/^\*\*+/, "")
    .replace(/\*\*+$/g, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^VERDICT:\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/[.;]+$/g, "")
    .trim();
}

function getVerdictLineCandidate(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(?:[-*]\s*)?(?:\*\*+|`+|["'])*VERDICT(?:\*\*+|`+|["'])*\s*:\s*(.+)$/i,
  );
  return match?.[1] ?? null;
}

function getLastVerdictMatch(raw: string): { line: string; index: number } {
  const lines = raw.split(/\r?\n/);
  let offset = raw.length;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? "";
    offset -= line.length;
    const candidate = getVerdictLineCandidate(line);
    if (candidate != null) {
      const normalized = normalizeVerdictLine(candidate);
      return { line: normalized, index: offset };
    }
    offset -= 1;
  }

  throw new Error(`Failed to parse verdict line: ${raw}`);
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

  const tokenMatch = normalizeVerdictLine(line).match(/[A-Za-z0-9]+/);
  if (!tokenMatch) {
    throw new Error(`Failed to parse verdict token: ${line}`);
  }

  const token = normalizeVerdictToken(tokenMatch[0] ?? "");

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

  const cleaned = normalizeVerdictLine(verdictLine).replace(/[\[\]]/g, "");
  const loweredMapping = labelMapping
    ? Object.fromEntries(
      Object.entries(labelMapping).map(([label, value]) => [label.toLowerCase(), value]),
    )
    : null;

  if (loweredMapping) {
    const matches = [...cleaned.matchAll(/[A-Za-z0-9]+/g)]
      .map((match) => match[0] ?? "")
      .map((token) => normalizeVerdictToken(token))
      .filter((token) => token.length > 0);
    const decoded = matches
      .map((token) => loweredMapping[token.toLowerCase()])
      .filter((value): value is number => value !== undefined);

    if (decoded.length > 0) {
      return {
        rawVerdict: verdictLine,
        decodedScores: Array.from(new Set(decoded)),
        abstained: false,
      };
    }
  }

  const tokens = cleaned
    .split(/[,\s/]+/)
    .map((t) => normalizeVerdictToken(t))
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
