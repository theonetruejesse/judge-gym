import type {
  BatchAdapter,
  BatchPollResult,
  BatchRequestInput,
  BatchSubmitResult,
} from "../utils/batch_adapter_registry";

export const geminiBatchAdapter: BatchAdapter = {
  async submitBatch(_requests: BatchRequestInput[]): Promise<BatchSubmitResult> {
    throw new Error(
      "Gemini batch adapter not implemented. Configure Vertex AI BatchPredictionJob integration.",
    );
  },
  async pollBatch(_batchRef: string): Promise<BatchPollResult> {
    throw new Error(
      "Gemini batch adapter not implemented. Configure Vertex AI BatchPredictionJob integration.",
    );
  },
  async cancelBatch(_batchRef: string): Promise<void> {
    throw new Error(
      "Gemini batch adapter not implemented. Configure Vertex AI BatchPredictionJob integration.",
    );
  },
};
