import { z } from "zod";

export const FirecrawlSourceSchema = z.enum(["news", "web", "images"]);
export type FirecrawlSource = z.infer<typeof FirecrawlSourceSchema>;

export const FirecrawlSettingsSchema = z.object({
  querySuffix: z.string().default("news articles"),
  includeCountryInQuery: z.boolean().default(true),
  sources: z.array(FirecrawlSourceSchema).default(["news"]),
  requestTimeoutMs: z.number().int().positive().default(45_000),
  searchTimeoutMs: z.number().int().positive().default(45_000),
  clientMaxRetries: z.number().int().min(0).default(2),
  maxAttempts: z.number().int().min(1).default(2),
  retryBackoffMs: z.number().int().min(0).default(2_000),
});

export type FirecrawlSettings = z.infer<typeof FirecrawlSettingsSchema>;

export const DEFAULT_FIRECRAWL_SETTINGS: FirecrawlSettings =
  FirecrawlSettingsSchema.parse({});
