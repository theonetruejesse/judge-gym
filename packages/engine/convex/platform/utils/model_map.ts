import { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { ModelType } from "../../models/core";

export const MODEL_MAP = {
  "gpt-4.1": openai("gpt-4.1-2025-04-14"),
  "gpt-4.1-mini": openai("gpt-4.1-mini-2025-04-14"),
  "gpt-5.2": openai("gpt-5.2-2025-12-11"),
  "gpt-5.2-chat": openai("gpt-5.2-chat-latest"),
  "claude-sonnet-4.5": anthropic("claude-sonnet-4-5-20250514"),
  "claude-haiku-4.5": anthropic("claude-haiku-4-5-20250514"),
  // "gemini-3.0-flash": google("gemini-3-flash-preview"),
  // TODO: Re-enable when Vertex integration is ready.
} satisfies Record<ModelType, LanguageModel>;
