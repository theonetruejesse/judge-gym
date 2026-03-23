import { z } from "zod";

export const TaskFailureClassSchema = z.enum([
  "quota_denied",
  "parse_error",
  "provider_error",
  "unexpected_error",
]);

export type TaskFailureClass = z.infer<typeof TaskFailureClassSchema>;

export const RetrySettingsSchema = z.object({
  parseFailureMaxAttempts: z.number().int().min(1).default(3),
  providerFailureMaxAttempts: z.number().int().min(1).default(3),
  unexpectedFailureMaxAttempts: z.number().int().min(1).default(2),
  quotaDeniedMaxAttempts: z.number().int().min(1).default(1),
  backoffMs: z.number().int().min(0).default(1_500),
});

export type RetrySettings = z.infer<typeof RetrySettingsSchema>;

export const DEFAULT_RETRY_SETTINGS: RetrySettings = RetrySettingsSchema.parse({});

const PARSE_ERROR_PATTERNS = [
  "failed to parse",
  "failed to find rubric block",
  "invalid rubric line",
  "invalid criteria count",
  "missing reasoning before",
  "unrecognized verdict label",
  "invalid probability value",
] as const;

const PROVIDER_ERROR_PATTERNS = [
  "api error",
  "fetch failed",
  "provider failed",
  "timeout",
  "timed out",
  "firecrawl",
  "rate limit",
  "service unavailable",
  "bad gateway",
  "gateway timeout",
] as const;

export function classifyTaskFailure(error: unknown): TaskFailureClass {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("quota reservation denied")) {
    return "quota_denied";
  }

  if (
    normalized.includes("invalid verdict")
    || PARSE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
  ) {
    return "parse_error";
  }

  if (PROVIDER_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return "provider_error";
  }

  return "unexpected_error";
}

export function resolveAttemptLimitForFailureClass(
  failureClass: TaskFailureClass,
  settings: RetrySettings = DEFAULT_RETRY_SETTINGS,
): number {
  switch (failureClass) {
    case "quota_denied":
      return settings.quotaDeniedMaxAttempts;
    case "parse_error":
      return settings.parseFailureMaxAttempts;
    case "provider_error":
      return settings.providerFailureMaxAttempts;
    default:
      return settings.unexpectedFailureMaxAttempts;
  }
}
