import z from "zod";
import { zInternalAction } from "../../utils/custom_fns";
import { modelTypeSchema } from "./provider_types";
import { findOpenAiBatchByMetadata, pollOpenAiBatch, submitOpenAiBatch } from "./openai_batch";
import { runAiChat } from "./ai_chat";

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
    return submitOpenAiBatch(args.requests, args.metadata);
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
    const result = await findOpenAiBatchByMetadata(args.metadata, args.limit ?? 100);
    if (!result) return { found: false as const };
    return {
      found: true as const,
      ...result,
    };
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
    return pollOpenAiBatch(args.batch_ref);
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
    return runAiChat(args);
  },
});
