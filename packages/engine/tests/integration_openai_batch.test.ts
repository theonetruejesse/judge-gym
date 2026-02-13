import { describe, expect, test } from "bun:test";
import { openaiBatchAdapter } from "../convex/platform/providers/openai_batch";
import type { BatchRequestInput } from "../convex/platform/utils/batch_adapter_registry";
import type { ModelType } from "../convex/models/core";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const shouldRun = Boolean(OPENAI_API_KEY);
const model: ModelType = "gpt-4.1-mini";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("openai batch integration", () => {
  test("submit + poll (single round)", async () => {
    if (!shouldRun) return;

    const requests: BatchRequestInput[] = [
      {
        custom_id: "test-1",
        stage: "rubric_gen",
        model,
        user_prompt: "Reply with the single word: ok",
        max_tokens: 16,
        temperature: 0,
      },
      {
        custom_id: "test-2",
        stage: "rubric_gen",
        model,
        user_prompt: "Reply with the single word: ping",
        max_tokens: 16,
        temperature: 0,
      },
    ];

    const submitted = await openaiBatchAdapter.submitBatch(requests);
    expect(submitted.batch_ref).toBeTruthy();

    await sleep(1000);
    const poll = await openaiBatchAdapter.pollBatch(submitted.batch_ref);

    expect(["running", "completed", "error"]).toContain(poll.status);
    if (poll.status === "error") {
      throw new Error(`OpenAI batch returned error: ${poll.error ?? "unknown"}`);
    }
    if (poll.status === "completed") {
      expect(poll.results?.length).toBe(requests.length);
    }
  }, 120_000);

  if (!shouldRun) {
    test("skipped: OPENAI_API_KEY not set", () => {
      expect(OPENAI_API_KEY).toBeUndefined();
    });
  }
});
