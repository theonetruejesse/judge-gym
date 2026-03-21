import { z } from "zod";
import { TEMPORAL_TASK_QUEUES } from "./temporal";

export const EngineSettingsSchema = z.object({
  temporal: z.object({
    retryDelayMs: z.number().int().positive().default(5_000),
    taskQueues: z.object({
      run: z.string().min(1).default(TEMPORAL_TASK_QUEUES.run),
      window: z.string().min(1).default(TEMPORAL_TASK_QUEUES.window),
    }),
  }).default({
    retryDelayMs: 5_000,
    taskQueues: {
      run: TEMPORAL_TASK_QUEUES.run,
      window: TEMPORAL_TASK_QUEUES.window,
    },
  }),
  quota: z.object({
    redisKeyPrefix: z.string().min(1).default("judge-gym:quota"),
  }).default({
    redisKeyPrefix: "judge-gym:quota",
  }),
  run: z.object({
    maxScoreTargetEstimatedInputTokens: z.number().int().positive().default(20_000),
  }).default({
    maxScoreTargetEstimatedInputTokens: 20_000,
  }),
});

export type EngineSettings = z.infer<typeof EngineSettingsSchema>;

export const DEFAULT_ENGINE_SETTINGS = EngineSettingsSchema.parse({});

export function resolveEngineSettings(
  overrides?: Partial<EngineSettings>,
): EngineSettings {
  return EngineSettingsSchema.parse(overrides ?? {});
}
