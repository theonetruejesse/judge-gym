import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  zCustomAction,
  zCustomMutation,
  zCustomQuery,
} from "convex-helpers/server/zod4";
import { NoOp } from "convex-helpers/server/customFunctions";

// --- Zod-wrapped function helpers ---
export const zMutation = zCustomMutation(mutation, NoOp);
export const zQuery = zCustomQuery(query, NoOp);
export const zInternalMutation = zCustomMutation(internalMutation, NoOp);
export const zInternalQuery = zCustomQuery(internalQuery, NoOp);
export const zInternalAction = zCustomAction(internalAction, NoOp);

// --- Model map ---
import { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { xai } from "@ai-sdk/xai";
import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ModelType } from "./schema";

const openrouter = createOpenRouter({});

export const MODEL_MAP = {
  "gpt-4.1": openai("gpt-4.1-2025-04-14"),
  "gpt-4.1-mini": openai("gpt-4.1-mini-2025-04-14"),
  "gpt-5.2": openai("gpt-5.2-2025-12-11"),
  "claude-sonnet-4.5": anthropic("claude-sonnet-4-5-20250514"),
  "claude-haiku-4.5": anthropic("claude-haiku-4-5-20250514"),
  "gemini-3-flash": google("gemini-3-flash-preview"),
  "grok-4.1-fast": xai("grok-4.1-fast"),
  "qwen3-235b": openrouter("qwen/qwen3-235b"),
} satisfies Record<ModelType, LanguageModel>;

// --- Provider resolution ---
type ProviderName =
  | "openai"
  | "anthropic"
  | "xai"
  | "google"
  | "openrouter";

const PROVIDER_MAP: Record<ModelType, ProviderName> = {
  "gpt-4.1": "openai",
  "gpt-4.1-mini": "openai",
  "gpt-5.2": "openai",
  "claude-sonnet-4.5": "anthropic",
  "claude-haiku-4.5": "anthropic",
  "gemini-3-flash": "google",
  "grok-4.1-fast": "xai",
  "qwen3-235b": "openrouter",
};

export function providerFor(modelId: ModelType): ProviderName {
  return PROVIDER_MAP[modelId];
}
