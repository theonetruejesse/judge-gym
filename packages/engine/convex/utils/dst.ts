/**
 * Lightweight engine-side DST (Dempster-Shafer Theory) utilities.
 * For sanity checks only — full analysis uses the Python implementation.
 * Deterministic — no LLM, no DB.
 */

export function massFromVerdict(
  decodedScores: number[],
): Map<string, number> {
  const key = [...decodedScores].sort().join(",");
  return new Map([[key, 1.0]]);
}

export function dempsterCombine(
  m1: Map<string, number>,
  m2: Map<string, number>,
): { combined: Map<string, number>; conflict: number } {
  const combined = new Map<string, number>();
  let k = 0;

  for (const [a, ma] of m1) {
    for (const [b, mb] of m2) {
      const setA = new Set(a.split(",").map(Number));
      const setB = new Set(b.split(",").map(Number));
      const intersection = [...setA].filter((x) => setB.has(x));

      if (intersection.length === 0) {
        k += ma * mb;
      } else {
        const key = intersection.sort().join(",");
        combined.set(key, (combined.get(key) ?? 0) + ma * mb);
      }
    }
  }

  const norm = 1 - k;
  const normalized = new Map<string, number>();
  for (const [key, val] of combined) {
    normalized.set(key, val / norm);
  }

  return { combined: normalized, conflict: k };
}
