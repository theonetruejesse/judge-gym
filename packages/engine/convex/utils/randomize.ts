/**
 * Label randomization for double randomization control.
 * Deterministic — no LLM, no DB.
 */

export function generateLabelMapping(
  scaleSize: number,
  seed?: number,
): Record<string, number> {
  const letters = Array.from({ length: scaleSize }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  const numbers = Array.from({ length: scaleSize }, (_, i) => i + 1);

  // Fisher-Yates shuffle (seeded for reproducibility if seed provided)
  const shuffled = [...numbers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j =
      seed !== undefined
        ? Math.abs(((seed * 2654435761) ^ (i * 2246822519)) % (i + 1))
        : Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const mapping: Record<string, number> = {};
  letters.forEach((letter, i) => {
    mapping[letter] = shuffled[i];
  });
  return mapping;
}
