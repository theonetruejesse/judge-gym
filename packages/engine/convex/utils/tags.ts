import { generateId } from "../platform/utils/randomize";
import { TAG_ADJECTIVES, TAG_NOUNS } from "./tag_words";

type WindowTagInput = {
  country: string;
  concept: string;
  start_date: string;
  end_date: string;
  model_id: string;
};

const NON_ALNUM = /[^a-z0-9_]+/g;
const DASH_RUN = /-+/g;

export function slugifyTagComponent(value: string): string {
  return value
    .toLowerCase()
    .replace(NON_ALNUM, "-")
    .replace(DASH_RUN, "-")
    .replace(/^-|-$/g, "");
}

function pickTagWord(words: string[], seed: number): string {
  const index = seed % words.length;
  return words[index] ?? words[0];
}

export function buildExperimentTag(): string {
  const id = generateId();
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const adjective = pickTagWord(TAG_ADJECTIVES, seed);
  const noun = pickTagWord(TAG_NOUNS, seed * 7);
  return `${adjective}-${noun}-${id}`;
}

export function buildWindowTag(input: WindowTagInput): string {
  return [
    input.country,
    input.concept,
    formatDateTag(input.start_date),
    formatDateTag(input.end_date),
    input.model_id,
  ]
    .map(slugifyTagComponent)
    .filter(Boolean)
    .join("-");
}

function formatDateTag(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replaceAll("-", "_");
  }
  return value;
}
