import { z } from "zod";

export const MediaCloudSettingsSchema = z.object({
  baseUrl: z.string().url().default("https://search.mediacloud.org/api/"),
  platform: z.string().default("onlinenews-mediacloud"),
  requestTimeoutMs: z.number().int().positive().default(60_000),
  defaultPageSize: z.number().int().positive().default(100),
  maxPageSize: z.number().int().positive().default(1_000),
  defaultSortOrder: z.string().nullable().default(null),
  maxRetries: z.number().int().nonnegative().default(3),
  initialBackoffMs: z.number().int().positive().default(1_000),
  maxBackoffMs: z.number().int().positive().default(10_000),
});

export type MediaCloudSettings = z.infer<typeof MediaCloudSettingsSchema>;

export const DEFAULT_MEDIACLOUD_SETTINGS: MediaCloudSettings =
  MediaCloudSettingsSchema.parse({});
