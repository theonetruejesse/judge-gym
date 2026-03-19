import { generateId } from "./randomize";


function pickTagWord(words: string[], seed: number): string {
  const index = seed % words.length;
  return words[index] ?? words[0];
}

export function buildRandomTag(): string {
  const id = generateId();
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const adjective = pickTagWord(TAG_ADJECTIVES, seed);
  const noun = pickTagWord(TAG_NOUNS, seed * 7);
  return `${adjective}-${noun}-${id}`;
}

const TAG_ADJECTIVES = [
  "silent",
  "swift",
  "steady",
  "bright",
  "calm",
  "clear",
  "brave",
  "bold",
  "eager",
  "faint",
  "gentle",
  "glad",
  "grand",
  "keen",
  "lively",
  "mellow",
  "noble",
  "proud",
  "quick",
  "quiet",
  "rapid",
  "shrewd",
  "smart",
  "solid",
  "sunny",
  "tidy",
  "trusty",
  "vivid",
  "warm",
  "wise",
];

const TAG_NOUNS = [
  "crane",
  "river",
  "forge",
  "harbor",
  "forest",
  "canyon",
  "summit",
  "valley",
  "meadow",
  "grove",
  "ridge",
  "stream",
  "bay",
  "island",
  "delta",
  "coast",
  "cliff",
  "glade",
  "field",
  "garden",
  "orchard",
  "bridge",
  "tower",
  "citadel",
  "compass",
  "anchor",
  "vessel",
  "beacon",
  "trail",
  "gate",
];
