import { describe, expect, test } from "bun:test";
import { getOrCreateLlmRequestImpl } from "../domain/llm_calls/llm_requests";

describe("llm_requests", () => {
  test("getOrCreateLlmRequest returns existing request when present", async () => {
    const existing = { _id: "req_existing" };
    const ctx: any = {
      db: {
        query: () => ({
          withIndex: () => ({
            unique: async () => existing,
          }),
        }),
        insert: async () => "req_new",
      },
    };

    const args = {
      stage: "rubric_gen",
      provider: "openai",
      model: "gpt-4.1",
      experiment_id: null,
      rubric_id: null,
      sample_id: null,
      evidence_id: null,
      request_version: 1,
    } as const;

    const result = await getOrCreateLlmRequestImpl(ctx, args);
    expect(result).toBe(existing);
  });

  test("getOrCreateLlmRequest creates new request when missing", async () => {
    const ctx: any = {
      db: {
        query: () => ({
          withIndex: () => ({
            unique: async () => null,
          }),
        }),
        insert: async () => "req_new",
      },
    };

    const args = {
      stage: "rubric_gen",
      provider: "openai",
      model: "gpt-4.1",
      experiment_id: null,
      rubric_id: null,
      sample_id: null,
      evidence_id: null,
      request_version: 1,
    } as const;

    const result = await getOrCreateLlmRequestImpl(ctx, args);
    expect(result).toBe("req_new");
  });
});
