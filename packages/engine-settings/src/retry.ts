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

export function classifyTaskFailure(error: unknown): TaskFailureClass {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("quota reservation denied")) {
    return "quota_denied";
  }

  if (
    normalized.includes("failed to parse")
    || normalized.includes("invalid probability")
    || normalized.includes("invalid verdict")
  ) {
    return "parse_error";
  }

  if (
    normalized.includes("api error")
    || normalized.includes("fetch failed")
    || normalized.includes("provider failed")
    || normalized.includes("timeout")
    || normalized.includes("timed out")
    || normalized.includes("firecrawl")
    || normalized.includes("rate limit")
    || normalized.includes("service unavailable")
    || normalized.includes("bad gateway")
    || normalized.includes("gateway timeout")
  ) {
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
