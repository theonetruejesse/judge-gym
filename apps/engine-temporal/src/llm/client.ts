import { getModelConfig } from "@judge-gym/engine-settings/provider";
import type { ModelType } from "@judge-gym/engine-settings/provider";
import { runAnthropicBatchChat, runAnthropicChat } from "./anthropic";
import {
  runOpenAiBatchChat,
  runOpenAiChat,
  type BatchChatRequest,
  type BatchChatFailure,
  type BatchChatSuccess,
  type ChatResult,
} from "./openai";
import { runOpenRouterChat } from "./openrouter";
import type { BatchSettings } from "@judge-gym/engine-settings/batch";

export type BatchChatCreatedEvent = {
  batchId: string;
  inputFileId?: string | null;
  status: string;
};

export type BatchChatLifecycleEvent = {
  phase: "submitted" | "polled" | "completed";
  batchId: string;
  status: string;
};

export type {
  BatchChatRequest,
  BatchChatFailure,
  BatchChatSuccess,
  ChatResult,
};

export async function runModelChat(args: {
  model: ModelType;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const { provider } = getModelConfig(args.model);
  switch (provider) {
    case "openai":
      return runOpenAiChat(args);
    case "anthropic":
      return runAnthropicChat(args);
    case "openrouter":
      return runOpenRouterChat(args);
    default:
      throw new Error(`Chat is not implemented for provider ${provider}.`);
  }
}

export async function runModelBatchChat<TMetadata>(args: {
  model: ModelType;
  items: Array<BatchChatRequest<TMetadata>>;
  settings: BatchSettings;
  timeoutMs?: number;
  existingBatchId?: string;
  onBatchCreated?: (event: BatchChatCreatedEvent) => Promise<void> | void;
  onLifecycleEvent?: (event: BatchChatLifecycleEvent) => Promise<void> | void;
}): Promise<{
  batchId: string;
  outputFileId: string | null;
  errorFileId: string | null;
  providerArtifactsJson?: string | null;
  succeeded: Array<BatchChatSuccess<TMetadata>>;
  failed: Array<BatchChatFailure<TMetadata>>;
}> {
  const { provider } = getModelConfig(args.model);
  switch (provider) {
    case "openai":
      return runOpenAiBatchChat(args);
    case "anthropic":
      return runAnthropicBatchChat(args);
    default:
      throw new Error(`Batch chat is not implemented for provider ${provider}.`);
  }
}
