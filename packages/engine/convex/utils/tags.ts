import { generateId } from "../platform/utils/randomize";
import { TAG_ADJECTIVES, TAG_NOUNS } from "./tag_words";

type WindowTagInput = {
  country: string;
  concept: string;
  start_date: string;
  end_date: string;
  model_id: string;
  window_tag?: string;
};

const WINDOW_TAG_FORMAT = /^[a-z]+-[a-z]+-[a-z0-9]+$/;

function pickTagWord(words: string[], seed: number): string {
  const index = seed % words.length;
  return words[index] ?? words[0];
}

export function buildExperimentTag(): string {
  return buildRandomTag();
}

export function buildWindowTag(input: WindowTagInput): string {
  if (input.window_tag && WINDOW_TAG_FORMAT.test(input.window_tag)) {
    return input.window_tag;
  }
  return buildRandomTag();
}

function buildRandomTag(): string {
  const id = generateId();
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const adjective = pickTagWord(TAG_ADJECTIVES, seed);
  const noun = pickTagWord(TAG_NOUNS, seed * 7);
  return `${adjective}-${noun}-${id}`;
}
