import { z } from "zod";

export const BatchModeSchema = z.enum([
  "disabled",
  "auto",
  "force",
]);

export type BatchMode = z.infer<typeof BatchModeSchema>;

export const BatchSettingsSchema = z.object({
  mode: BatchModeSchema.default("auto"),
  minBatchSize: z.number().int().min(1).default(35),
  maxBatchSize: z.number().int().min(1).default(500),
  maxBatchRequestBytes: z.number().int().positive().default(4_000_000),
  maxEnqueuedInputTokensPerBatch: z.number().int().positive().nullable().default(null),
  maxConcurrentBatches: z.number().int().min(1).default(4),
  completionWindow: z.enum(["24h"]).default("24h"),
  requestTimeoutMs: z.number().int().positive().default(120_000),
  transportMaxAttempts: z.number().int().min(1).default(3),
  transportBackoffMs: z.number().int().min(0).default(2_000),
  pollIntervalMs: z.number().int().positive().default(5_000),
  maxWaitMs: z.number().int().positive().default(24 * 60 * 60 * 1_000),
});

export type BatchSettings = z.infer<typeof BatchSettingsSchema>;

export type ProviderBatchConstraints = {
  maxRequestsPerBatch?: number | null;
  maxBatchRequestBytes?: number | null;
  maxEnqueuedInputTokensPerBatch?: number | null;
};

export const DEFAULT_BATCH_SETTINGS: BatchSettings = BatchSettingsSchema.parse({});

export function shouldUseBatching(args: {
  batchable: boolean;
  itemCount: number;
  settings?: BatchSettings;
}): boolean {
  const settings = args.settings ?? DEFAULT_BATCH_SETTINGS;

  if (settings.mode === "disabled") {
    return false;
  }

  if (settings.mode === "force") {
    return args.batchable;
  }

  return args.batchable && args.itemCount >= settings.minBatchSize;
}

export function resolveEffectiveBatchConstraints(args: {
  settings?: BatchSettings;
  providerConstraints?: ProviderBatchConstraints | null;
}) {
  const settings = args.settings ?? DEFAULT_BATCH_SETTINGS;
  const providerConstraints = args.providerConstraints ?? null;

  return {
    maxBatchSize: Math.min(
      settings.maxBatchSize,
      providerConstraints?.maxRequestsPerBatch ?? Number.POSITIVE_INFINITY,
    ),
    maxBatchRequestBytes: Math.min(
      settings.maxBatchRequestBytes,
      providerConstraints?.maxBatchRequestBytes ?? Number.POSITIVE_INFINITY,
    ),
    maxEnqueuedInputTokensPerBatch: Math.min(
      settings.maxEnqueuedInputTokensPerBatch ?? Number.POSITIVE_INFINITY,
      providerConstraints?.maxEnqueuedInputTokensPerBatch ?? Number.POSITIVE_INFINITY,
    ),
  };
}
