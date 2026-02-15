import { describe, expect, test } from "bun:test";
import { computeRetryDecision } from "../convex/domain/llm_calls/workflows/llm_calls_batch_poll_logic";

describe("batch_poll computeRetryDecision", () => {
  test("requeues when under retry limit", () => {
    const now = 1_000_000;
    const decision = computeRetryDecision({
      attempt: 0,
      max_retries: 2,
      now,
      backoff_ms: 5000,
      error: "batch_failed",
    });

    expect(decision.status).toBe("queued");
    expect(decision.attempt).toBe(1);
    expect(decision.next_retry_at).toBe(now + 5000);
  });

  test("marks error when retry limit exceeded", () => {
    const now = 1_000_000;
    const decision = computeRetryDecision({
      attempt: 2,
      max_retries: 2,
      now,
      backoff_ms: 5000,
      error: "batch_failed",
    });

    expect(decision.status).toBe("error");
    expect(decision.attempt).toBe(3);
    expect(decision.next_retry_at).toBeUndefined();
  });
});
