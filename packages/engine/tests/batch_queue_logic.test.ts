import { describe, expect, test } from "bun:test";
import {
  selectBatchCandidates,
  type QueuedRequest,
  type RunCandidate,
} from "../convex/domain/llm_calls/workflows/llm_calls_batch_queue_logic";
import type { RunPolicy } from "../convex/models/core";

const basePolicy: RunPolicy = {
  poll_interval_ms: 5000,
  max_batch_size: 2,
  max_new_batches_per_tick: 2,
  max_poll_per_tick: 2,
  max_batch_retries: 1,
  max_request_attempts: 2,
  retry_backoff_ms: 1000,
  provider_models: [
    { provider: "openai", models: ["gpt-4.1"] },
  ],
};

describe("batch_queue selectBatchCandidates", () => {
  test("selects largest runnable group and applies policy max_batch_size", () => {
    const now = Date.now();
    const queued: QueuedRequest[] = [
      {
        _id: "req_a1",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_a2",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "score_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_a3",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "score_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_b1",
        experiment_id: "exp_b",
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_none",
        experiment_id: null,
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_future",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
        next_retry_at: now + 10_000,
      },
    ];

    const runs: RunCandidate[] = [
      {
        _id: "run_a",
        experiment_id: "exp_a",
        desired_state: "running" as const,
        policy: basePolicy,
        updated_at: now,
      },
      {
        _id: "run_b",
        experiment_id: "exp_b",
        desired_state: "paused" as const,
        policy: basePolicy,
        updated_at: now,
      },
    ];

    const result = selectBatchCandidates({
      queued,
      runs,
      provider: "openai",
      model: "gpt-4.1",
      max_items: 10,
      now,
    });

    expect(result.run_id).toBe("run_a");
    expect(result.items).toHaveLength(2);
    expect(result.items.every((req) => req.experiment_id === "exp_a"))
      .toBe(true);
  });

  test("respects stop_at_stage", () => {
    const now = Date.now();
    const queued: QueuedRequest[] = [
      {
        _id: "req_ok",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_blocked_stage",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "score_gen",
        user_prompt: "hi",
        attempt: 0,
      },
    ];

    const runs: RunCandidate[] = [
      {
        _id: "run_a",
        experiment_id: "exp_a",
        desired_state: "running" as const,
        stop_at_stage: "rubric_gen" as const,
        policy: basePolicy,
        updated_at: now,
      },
    ];

    const result = selectBatchCandidates({
      queued,
      runs,
      provider: "openai",
      model: "gpt-4.1",
      max_items: 10,
      now,
    });

    expect(result.items.map((req) => req._id)).toEqual(["req_ok"]);
  });

  test("filters out requests when run policy disallows model", () => {
    const now = Date.now();
    const queued: QueuedRequest[] = [
      {
        _id: "req_blocked",
        experiment_id: "exp_a",
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
      },
      {
        _id: "req_unscoped",
        experiment_id: null,
        provider: "openai",
        model: "gpt-4.1",
        stage: "rubric_gen",
        user_prompt: "hi",
        attempt: 0,
      },
    ];

    const disallowPolicy: RunPolicy = {
      ...basePolicy,
      provider_models: [
        { provider: "anthropic", models: ["claude-haiku-4.5"] },
      ],
    };

    const runs: RunCandidate[] = [
      {
        _id: "run_a",
        experiment_id: "exp_a",
        desired_state: "running" as const,
        policy: disallowPolicy,
        updated_at: now,
      },
    ];

    const result = selectBatchCandidates({
      queued,
      runs,
      provider: "openai",
      model: "gpt-4.1",
      max_items: 10,
      now,
    });

    expect(result.items.map((req) => req._id)).toEqual(["req_unscoped"]);
  });
});
