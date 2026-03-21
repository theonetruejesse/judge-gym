import { z } from "zod";
import {
  BatchSettingsSchema,
  DEFAULT_BATCH_SETTINGS,
} from "./batch";
import {
  DEFAULT_FIRECRAWL_SETTINGS,
  FirecrawlSettingsSchema,
} from "./firecrawl";
import {
  DEFAULT_RETRY_SETTINGS,
  RetrySettingsSchema,
} from "./retry";
import {
  DEFAULT_PROVIDER_EXECUTION_SETTINGS,
  ProviderExecutionSettingsSchema,
} from "./provider";
import { TEMPORAL_TASK_QUEUES } from "./temporal";

export const EngineSettingsSchema = z.object({
  temporal: z.object({
    retryDelayMs: z.number().int().positive().default(5_000),
    activityStartToCloseMs: z.number().int().positive().default(60 * 60 * 1_000),
    taskQueues: z.object({
      run: z.string().min(1).default(TEMPORAL_TASK_QUEUES.run),
      window: z.string().min(1).default(TEMPORAL_TASK_QUEUES.window),
    }),
  }).default({
    retryDelayMs: 5_000,
    activityStartToCloseMs: 60 * 60 * 1_000,
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
  providers: ProviderExecutionSettingsSchema.default(
    DEFAULT_PROVIDER_EXECUTION_SETTINGS,
  ),
  llm: z.object({
    batching: BatchSettingsSchema.default(DEFAULT_BATCH_SETTINGS),
    direct: z.object({
      maxConcurrentRequests: z.number().int().positive().default(4),
    }).default({
      maxConcurrentRequests: 4,
    }),
    requestTimeoutMs: z.number().int().positive().default(120_000),
    retries: RetrySettingsSchema.default(DEFAULT_RETRY_SETTINGS),
  }).default({
    batching: DEFAULT_BATCH_SETTINGS,
    direct: {
      maxConcurrentRequests: 4,
    },
    requestTimeoutMs: 120_000,
    retries: DEFAULT_RETRY_SETTINGS,
  }),
  window: z.object({
    firecrawl: FirecrawlSettingsSchema.default(DEFAULT_FIRECRAWL_SETTINGS),
    maxStageInputChars: z.number().int().positive().default(20_000),
  }).default({
    firecrawl: DEFAULT_FIRECRAWL_SETTINGS,
    maxStageInputChars: 20_000,
  }),
  run: z.object({
    maxScoreTargetEstimatedInputTokens: z.number().int().positive().default(20_000),
  }).default({
    maxScoreTargetEstimatedInputTokens: 20_000,
  }),
});

export type EngineSettings = z.infer<typeof EngineSettingsSchema>;

export const ENGINE_SETTINGS_CONFIG: EngineSettings = {
  temporal: {
    retryDelayMs: 5_000,
    activityStartToCloseMs: 60 * 60 * 1_000,
    taskQueues: {
      run: TEMPORAL_TASK_QUEUES.run,
      window: TEMPORAL_TASK_QUEUES.window,
    },
  },
  quota: {
    redisKeyPrefix: "judge-gym:quota",
  },
  providers: DEFAULT_PROVIDER_EXECUTION_SETTINGS,
  llm: {
    batching: {
      mode: "auto",
      minBatchSize: 30,
      maxBatchSize: 500,
      maxConcurrentBatches: 4,
      completionWindow: "24h",
      pollIntervalMs: 5_000,
      maxWaitMs: 30 * 60 * 1_000,
    },
    direct: {
      maxConcurrentRequests: 4,
    },
    requestTimeoutMs: 120_000,
    retries: DEFAULT_RETRY_SETTINGS,
  },
  window: {
    firecrawl: DEFAULT_FIRECRAWL_SETTINGS,
    maxStageInputChars: 20_000,
  },
  run: {
    maxScoreTargetEstimatedInputTokens: 20_000,
  },
};

export const DEFAULT_ENGINE_SETTINGS = EngineSettingsSchema.parse(
  ENGINE_SETTINGS_CONFIG,
);

export function resolveEngineSettings(
  overrides?: Partial<EngineSettings>,
): EngineSettings {
  return EngineSettingsSchema.parse({
    ...ENGINE_SETTINGS_CONFIG,
    ...(overrides ?? {}),
  });
}

export * from "./batch";
export * from "./firecrawl";
export * from "./provider";
export * from "./retry";
