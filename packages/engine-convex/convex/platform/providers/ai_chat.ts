import { generateText, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  getProviderForModel,
  getProviderModel,
  type ModelType,
} from "./provider_types";

const MODEL_CACHE = new Map<ModelType, LanguageModel>();

function resolveLanguageModel(model: ModelType): LanguageModel {
  const cached = MODEL_CACHE.get(model);
  if (cached) return cached;

  const provider = getProviderForModel(model);
  const providerModel = getProviderModel(model);

  let resolved: LanguageModel;
  switch (provider) {
    case "openai":
      resolved = openai(providerModel);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  MODEL_CACHE.set(model, resolved);
  return resolved;
}

type ChatInput = {
  model: ModelType;
  system_prompt?: string;
  user_prompt: string;
  max_tokens?: number;
};

type ChatOutput = {
  assistant_output: string;
  input_tokens?: number;
  output_tokens?: number;
};

export async function runAiChat(input: ChatInput): Promise<ChatOutput> {
  const result = await generateText({
    model: resolveLanguageModel(input.model),
    system: input.system_prompt,
    prompt: input.user_prompt,
    ...(input.max_tokens !== undefined
      ? { maxOutputTokens: input.max_tokens }
      : {}),
  });

  return {
    assistant_output: result.text,
    input_tokens: result.usage.inputTokens ?? undefined,
    output_tokens: result.usage.outputTokens ?? undefined,
  };
}
