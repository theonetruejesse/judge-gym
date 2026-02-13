import type { LlmStage, Provider, ModelType } from "../../models/core";

export type BatchRequestInput = {
  custom_id: string;
  stage: LlmStage;
  model: ModelType;
  system_prompt?: string;
  user_prompt: string;
  temperature?: number;
  top_p?: number;
  seed?: number;
  max_tokens?: number;
  stop?: string[];
};

export type BatchSubmitResult = {
  batch_ref: string;
  completion_window?: string;
};

export type BatchItemResult = {
  custom_id: string;
  status: "completed" | "error";
  output?: {
    assistant_output?: string;
    assistant_reasoning?: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cached_input_tokens?: number;
    reasoning_tokens?: number;
  };
  error?: string;
};

export type BatchPollResult = {
  status: "queued" | "running" | "completed" | "error" | "canceled";
  results?: BatchItemResult[];
  error?: string;
};

export interface BatchAdapter {
  submitBatch(requests: BatchRequestInput[]): Promise<BatchSubmitResult>;
  pollBatch(batchRef: string): Promise<BatchPollResult>;
  cancelBatch(batchRef: string): Promise<void>;
}

export type BatchAdapterRegistry = Record<Provider, BatchAdapter>;

export function createRegistry(registry: BatchAdapterRegistry): BatchAdapterRegistry {
  return registry;
}
