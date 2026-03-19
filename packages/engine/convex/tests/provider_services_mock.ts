import z from "zod";
import { zInternalAction } from "../utils/custom_fns";
import { modelTypeSchema, type ModelType } from "../platform/providers/provider_types";

type BatchRequest = {
  custom_key: string;
  model: ModelType;
  system_prompt?: string;
  user_prompt: string;
  max_tokens?: number;
};

type BatchMetadata = {
  engine_batch_id: string;
  engine_submission_id: string;
};

type StoredBatch = {
  requests: BatchRequest[];
  metadata: BatchMetadata;
  input_file_id: string;
};

type BatchStatus = "completed" | "running" | "error";
type SubmitMode = "success" | "unknown_outcome";

type ChatMode = "success" | "error";
type BatchOutputResolver = (req: BatchRequest, index: number) => {
  assistant_output: string;
  input_tokens?: number;
  output_tokens?: number;
};

let batchCounter = 0;
const batches = new Map<string, StoredBatch>();
let batchMode: BatchStatus = "completed";
let chatMode: ChatMode = "success";
let batchOutputResolver: BatchOutputResolver | null = null;
let submitMode: SubmitMode = "success";

export function __resetMockProviders() {
  batchCounter = 0;
  batches.clear();
  batchMode = "completed";
  chatMode = "success";
  batchOutputResolver = null;
  submitMode = "success";
}

export function __setMockBatchMode(mode: BatchStatus) {
  batchMode = mode;
}

export function __setMockChatMode(mode: ChatMode) {
  chatMode = mode;
}

export function __setMockSubmitMode(mode: SubmitMode) {
  submitMode = mode;
}

export function __setMockBatchOutputResolver(resolver: BatchOutputResolver | null) {
  batchOutputResolver = resolver;
}

const BatchRequestSchema = z.object({
  custom_key: z.string(),
  model: modelTypeSchema,
  system_prompt: z.string().optional(),
  user_prompt: z.string(),
  max_tokens: z.number().int().positive().optional(),
});

const BatchSubmitResultSchema = z.object({
  batch_ref: z.string(),
  input_file_id: z.string(),
});

export async function __submitMockBatch(
  requests: BatchRequest[],
  metadata: BatchMetadata,
) {
  const batch_ref = `mock_batch_${batchCounter += 1}`;
  const input_file_id = `mock_file_${batchCounter}`;
  batches.set(batch_ref, {
    requests,
    metadata,
    input_file_id,
  });
  if (submitMode === "unknown_outcome") {
    throw new Error("mock_submit_unknown_outcome");
  }
  return { batch_ref, input_file_id };
}

export const submitOpenAiBatchAction = zInternalAction({
  args: z.object({
    requests: z.array(BatchRequestSchema),
    metadata: z.object({
      engine_batch_id: z.string(),
      engine_submission_id: z.string(),
    }),
  }),
  returns: BatchSubmitResultSchema,
  handler: async (_ctx, args) => {
    return __submitMockBatch(args.requests as BatchRequest[], args.metadata);
  },
});

const BatchLookupResultSchema = z.union([
  z.object({
    found: z.literal(false),
  }),
  z.object({
    found: z.literal(true),
    batch_ref: z.string(),
    input_file_id: z.string().optional(),
    status: z.string(),
  }),
]);

export async function __findMockBatchByMetadata(
  metadata: BatchMetadata,
) {
  const entry = [...batches.entries()].find(([, batch]) =>
    batch.metadata.engine_batch_id === metadata.engine_batch_id
    && batch.metadata.engine_submission_id === metadata.engine_submission_id,
  );
  if (!entry) {
    return { found: false as const };
  }
  const [batch_ref, batch] = entry;
  return {
    found: true as const,
    batch_ref,
    input_file_id: batch.input_file_id,
    status: batchMode === "error" ? "failed" : batchMode === "running" ? "in_progress" : "completed",
  };
}

export const findOpenAiBatchByMetadataAction = zInternalAction({
  args: z.object({
    metadata: z.object({
      engine_batch_id: z.string(),
      engine_submission_id: z.string(),
    }),
    limit: z.number().int().positive().optional(),
  }),
  returns: BatchLookupResultSchema,
  handler: async (_ctx, args) => {
    return __findMockBatchByMetadata(args.metadata);
  },
});

const BatchPollResultSchema = z.union([
  z.object({
    status: z.literal("running"),
  }),
  z.object({
    status: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    status: z.literal("completed"),
    results: z.array(
      z.object({
        custom_key: z.string(),
        status: z.union([z.literal("completed"), z.literal("error")]),
        output: z
          .object({
            assistant_output: z.string(),
            input_tokens: z.number().optional(),
            output_tokens: z.number().optional(),
          })
          .optional(),
        error: z.string().optional(),
      }),
    ),
  }),
]);

export const pollOpenAiBatchAction = zInternalAction({
  args: z.object({ batch_ref: z.string() }),
  returns: BatchPollResultSchema,
  handler: async (_ctx, args) => {
    if (batchMode === "running") {
      return { status: "running" as const };
    }
    if (batchMode === "error") {
      return { status: "error" as const, error: "mock_batch_error" };
    }

    const requests = batches.get(args.batch_ref)?.requests ?? [];
    return {
      status: "completed" as const,
      results: requests.map((req, index) => {
        const output = batchOutputResolver
          ? batchOutputResolver(req, index)
          : {
            assistant_output: `mock_output_${index}`,
            input_tokens: 5,
            output_tokens: 3,
          };
        return {
          custom_key: req.custom_key,
          status: "completed" as const,
          output,
        };
      }),
    };
  },
});

const ChatInputSchema = z.object({
  model: modelTypeSchema,
  system_prompt: z.string().optional(),
  user_prompt: z.string(),
  max_tokens: z.number().int().positive().optional(),
});

const ChatOutputSchema = z.object({
  assistant_output: z.string(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
});

export const openAiChatAction = zInternalAction({
  args: ChatInputSchema,
  returns: ChatOutputSchema,
  handler: async (_ctx, args) => {
    if (chatMode === "error") {
      throw new Error("mock_provider_error");
    }
    return {
      assistant_output: `mock:${args.user_prompt}`,
      input_tokens: 7,
      output_tokens: 4,
    };
  },
});
