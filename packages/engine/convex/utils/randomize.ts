/**
 * Label randomization for double randomization control.
 * Uses nanoid-style alphanumeric IDs instead of letters so the model
 * cannot infer ordinal position from the label itself.
 *
 * Deterministic — seeded PRNG for reproducibility. No LLM, no DB.
 */

import { customAlphabet } from "nanoid";

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ID_LENGTH = 6;
const nanoid = customAlphabet(ALPHABET, ID_LENGTH);

/** Generate a random 6-char alphanumeric ID (non-deterministic). */
export const generateId = () => nanoid();

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32) — fast 32-bit generator with good distribution.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a deterministic ID from a seed and index. */
function seededId(seed: number, index: number): string {
  // Derive a unique sub-seed per (seed, index) pair
  const rng = mulberry32(
    Math.imul(seed | 0, 2654435761) ^ Math.imul(index + 1, 2246822519),
  );
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a label mapping: `{ nanoid: stageNumber }`.
 *
 * Each rubric stage (1..scaleSize) gets a unique opaque 6-char ID.
 * The model sees these IDs instead of A/B/C/D, removing any ordinal cue.
 *
 * When `seed` is provided, generation is fully deterministic (reproducible).
 * Without a seed, IDs are cryptographically random via nanoid.
 */
export function generateLabelMapping(
  scaleSize: number,
  seed?: number,
): Record<string, number> {
  const mapping: Record<string, number> = {};
  const usedIds = new Set<string>();

  for (let i = 0; i < scaleSize; i++) {
    let id: string;
    if (seed !== undefined) {
      id = seededId(seed, i);
      // Collision is astronomically unlikely (62^6 ≈ 57B), but handle it
      let attempt = 0;
      while (usedIds.has(id)) {
        attempt++;
        id = seededId(seed + attempt * 1000003, i);
      }
    } else {
      do {
        id = nanoid();
      } while (usedIds.has(id));
    }
    usedIds.add(id);
    mapping[id] = i + 1; // 1-indexed stage number
  }

  return mapping;
}
