import {
  ENGINE_ENV_KEYS,
  TEMPORAL_TASK_QUEUES,
} from "@judge-gym/engine-settings";

export type TemporalRuntimeConfig = {
  address: string;
  namespace: string;
  retryDelayMs: number;
  taskQueues: {
    run: string;
    window: string;
  };
};

export function getTemporalRuntimeConfig(): TemporalRuntimeConfig {
  const sharedTaskQueue = process.env[ENGINE_ENV_KEYS.temporalTaskQueue];
  return {
    address:
      process.env[ENGINE_ENV_KEYS.temporalAddress] ?? "localhost:7233",
    namespace:
      process.env[ENGINE_ENV_KEYS.temporalNamespace] ?? "default",
    retryDelayMs: Number(
      process.env[ENGINE_ENV_KEYS.temporalRetryDelayMs] ?? 5000,
    ),
    taskQueues: {
      run:
        process.env[ENGINE_ENV_KEYS.temporalRunTaskQueue] ??
        sharedTaskQueue ??
        TEMPORAL_TASK_QUEUES.run,
      window:
        process.env[ENGINE_ENV_KEYS.temporalWindowTaskQueue] ??
        sharedTaskQueue ??
        TEMPORAL_TASK_QUEUES.window,
    },
  };
}
