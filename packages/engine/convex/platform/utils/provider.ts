import type { ModelType } from "../../models/core";

export type ProviderName =
  | "openai"
  | "anthropic";
// | "google"; // TODO: Re-enable when Vertex integration is ready.

const PROVIDER_MAP: Record<ModelType, ProviderName> = {
  "gpt-4.1": "openai",
  "gpt-4.1-mini": "openai",
  "gpt-5.2-chat": "openai",
  "gpt-5.2": "openai",
  "claude-sonnet-4.5": "anthropic",
  "claude-haiku-4.5": "anthropic",
  // "gemini-3.0-flash": "google",
  // TODO: Re-enable when Vertex integration is ready.
};

export function providerFor(modelId: ModelType): ProviderName {
  return PROVIDER_MAP[modelId];
}
