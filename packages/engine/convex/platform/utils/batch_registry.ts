import { createRegistry } from "./batch_adapter_registry";
import { openaiBatchAdapter } from "../providers/openai_batch";
import { anthropicBatchAdapter } from "../providers/anthropic_batch";
// import { geminiBatchAdapter } from "../providers/gemini_batch"; // TODO: Re-enable when Vertex integration is ready.

export const batchAdapterRegistry = createRegistry({
  openai: openaiBatchAdapter,
  anthropic: anthropicBatchAdapter,
  // google: geminiBatchAdapter,
  // TODO: Re-enable when Vertex integration is ready.
});
