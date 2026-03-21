import { z } from "zod";

export const BatchModeSchema = z.enum([
  "disabled",
  "auto",
  "force",
]);

export type BatchMode = z.infer<typeof BatchModeSchema>;

export const BatchSettingsSchema = z.object({
  mode: BatchModeSchema.default("auto"),
  minBatchSize: z.number().int().min(1).default(30),
  maxBatchSize: z.number().int().min(1).default(500),
  maxConcurrentBatches: z.number().int().min(1).default(4),
  completionWindow: z.enum(["24h"]).default("24h"),
  requestTimeoutMs: z.number().int().positive().default(120_000),
  transportMaxAttempts: z.number().int().min(1).default(3),
  transportBackoffMs: z.number().int().min(0).default(2_000),
  pollIntervalMs: z.number().int().positive().default(5_000),
  maxWaitMs: z.number().int().positive().default(2 * 60 * 60 * 1_000),
});

export type BatchSettings = z.infer<typeof BatchSettingsSchema>;

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
