import z from "zod";
import { zInternalAction } from "../../utils/custom_fns";
import { modelTypeSchema } from "./provider_types";
import { pollOpenAiBatch, submitOpenAiBatch } from "./openai_batch";
import { openAiChat } from "./openai_chat";

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
    return submitOpenAiBatch(args.requests);
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
    return openAiChat(args);
  },
});
