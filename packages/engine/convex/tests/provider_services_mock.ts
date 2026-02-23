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

type BatchStatus = "completed" | "running" | "error";

type ChatMode = "success" | "error";

let batchCounter = 0;
const batches = new Map<string, BatchRequest[]>();
let batchMode: BatchStatus = "completed";
let chatMode: ChatMode = "success";

export function __resetMockProviders() {
  batchCounter = 0;
  batches.clear();
  batchMode = "completed";
  chatMode = "success";
}

export function __setMockBatchMode(mode: BatchStatus) {
  batchMode = mode;
}

export function __setMockChatMode(mode: ChatMode) {
  chatMode = mode;
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
});

export const submitOpenAiBatchAction = zInternalAction({
  args: z.object({ requests: z.array(BatchRequestSchema) }),
  returns: BatchSubmitResultSchema,
  handler: async (_ctx, args) => {
    const batch_ref = `mock_batch_${batchCounter += 1}`;
    batches.set(batch_ref, args.requests as BatchRequest[]);
    return { batch_ref };
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

    const requests = batches.get(args.batch_ref) ?? [];
    return {
      status: "completed" as const,
      results: requests.map((req, index) => ({
        custom_key: req.custom_key,
        status: "completed" as const,
        output: {
          assistant_output: `mock_output_${index}`,
          input_tokens: 5,
          output_tokens: 3,
        },
      })),
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
