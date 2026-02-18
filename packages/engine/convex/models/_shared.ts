import z from "zod";

// todo, update once batching/workflow is stable
export const modelTypeSchema = z.union([
    z.literal("gpt-4.1"),
    z.literal("gpt-4.1-mini"),
    z.literal("gpt-5.2"),
    z.literal("gpt-5.2-chat"),
]);

export type ModelType = z.infer<typeof modelTypeSchema>;

export const providerTypeSchema = z.union([
    z.literal("openai"),
]);

export type ProviderType = z.infer<typeof providerTypeSchema>;

export const StateStatusSchema = z.enum([
    "start",
    "running",
    "paused",
    "completed",
    "canceled",
]);

export type StateStatus = z.infer<typeof StateStatusSchema>;