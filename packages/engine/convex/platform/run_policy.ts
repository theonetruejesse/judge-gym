import z from "zod";


export const RunPolicySchema = z.object({
  // Minimum time between batch polls (ms).
  poll_interval_ms: z.number().int().min(500),
  // Cap requests per batch.
  max_batch_size: z.number().int().min(1),
  // Minimum number of requests required to use batching.
  min_batch_size: z.number().int().min(1),
  // Fallback to jobs when remaining requests fall below this count.
  job_fallback_count: z.number().int().min(0),
  // Per-request token cap (input + output). This is a hard guardrail.
  max_tokens: z.number().int().min(1),
  // Max number of times a provider batch can be re-polled/retried.
  max_batch_retries: z.number().int().min(0),
  // Max number of attempts per request (batch or job).
  max_request_attempts: z.number().int().min(1),
  // Backoff before retrying failed job requests (ms).
  retry_backoff_ms: z.number().int().min(0),
});

export type RunPolicy = z.infer<typeof RunPolicySchema>;
