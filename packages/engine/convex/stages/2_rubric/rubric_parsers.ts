export function parseRubricResponse(
  raw: string,
  scaleSize: number,
): {
  reasoning: string;
  stages: Array<{ label: string; criteria: string[] }>;
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

  const stages = lines.map((line) => {
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
    return { label, criteria };
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
