export type RetryDecision = {
  status: "queued" | "error";
  attempt: number;
  last_error: string;
  next_retry_at?: number;
};

export function computeRetryDecision(args: {
  attempt: number;
  max_retries: number;
  now: number;
  backoff_ms: number;
  error: string;
}): RetryDecision {
  const { attempt, max_retries, now, backoff_ms, error } = args;
  const nextAttempt = attempt + 1;
  if (nextAttempt <= max_retries) {
    return {
      status: "queued",
      attempt: nextAttempt,
      last_error: error,
      next_retry_at: now + backoff_ms,
    };
  }
  return {
    status: "error",
    attempt: nextAttempt,
    last_error: error,
  };
}
