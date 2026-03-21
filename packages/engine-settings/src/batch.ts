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
