export const TEMPORAL_TASK_QUEUES = {
  run: "judge-gym.run",
  window: "judge-gym.window",
} as const;

export const WORKER_AUTH_HEADER = "x-judge-gym-worker-secret";

export const ENGINE_ENV_KEYS = {
  convexUrl: "CONVEX_URL",
  workerSecretActive: "CONVEX_WORKER_SECRET_ACTIVE",
  upstashUrl: "UPSTASH_REDIS_REST_URL",
  upstashToken: "UPSTASH_REDIS_REST_TOKEN",
  temporalAddress: "TEMPORAL_ADDRESS",
  temporalNamespace: "TEMPORAL_NAMESPACE",
  temporalRetryDelayMs: "TEMPORAL_RETRY_DELAY_MS",
  temporalRunTaskQueue: "TEMPORAL_RUN_TASK_QUEUE",
  temporalWindowTaskQueue: "TEMPORAL_WINDOW_TASK_QUEUE",
  openaiApiKey: "OPENAI_API_KEY",
  anthropicApiKey: "ANTHROPIC_API_KEY",
  googleGenerativeAiApiKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  firecrawlApiKey: "FIRECRAWL_API_KEY",
  axiomDataset: "AXIOM_DATASET",
  axiomToken: "AXIOM_TOKEN",
} as const;
