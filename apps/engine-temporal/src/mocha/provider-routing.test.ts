import assert from "assert";
import { afterEach, describe, it } from "mocha";
import { DEFAULT_BATCH_SETTINGS } from "@judge-gym/engine-settings";
import {
  getProviderBatchMode,
  getProviderForModel,
  getProviderModel,
  isBatchableModel,
  providerSupportsBatching,
} from "@judge-gym/engine-settings/provider";
import { runModelBatchChat, runModelChat } from "../llm/client";
import { getModelConfig } from "../window/model_registry";

const originalFetch = globalThis.fetch;

function createMockFetch(response: Response): typeof fetch {
  return Object.assign(
    async () => response,
    {
      preconnect: () => undefined,
    },
  ) as unknown as typeof fetch;
}

function createHandlerFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return Object.assign(handler, {
    preconnect: () => undefined,
  }) as unknown as typeof fetch;
}

describe("provider routing", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  it("resolves provider metadata for the new models", () => {
    assert.equal(getProviderForModel("claude-sonnet-4"), "anthropic");
    assert.equal(getProviderForModel("claude-sonnet-4-openrouter"), "openrouter");
    assert.equal(getProviderModel("claude-sonnet-4-openrouter"), "anthropic/claude-sonnet-4");

    const anthropicConfig = getModelConfig("claude-sonnet-4");
    assert.equal(anthropicConfig.provider, "anthropic");
    assert.equal(anthropicConfig.providerModel, "claude-sonnet-4-20250514");
  });

  it("tracks provider-native batching separately from current model batchability", () => {
    assert.equal(getProviderBatchMode("anthropic"), "native");
    assert.equal(getProviderBatchMode("openrouter"), "none");
    assert.equal(providerSupportsBatching("anthropic"), true);
    assert.equal(providerSupportsBatching("openrouter"), false);
    assert.equal(isBatchableModel("claude-sonnet-4"), true);
    assert.equal(isBatchableModel("claude-sonnet-4-openrouter"), false);
  });

  it("dispatches direct chat calls to Anthropic", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
    globalThis.fetch = createMockFetch(
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "anthropic response" },
          ],
          usage: {
            input_tokens: 11,
            output_tokens: 7,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const result = await runModelChat({
      model: "claude-sonnet-4",
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.equal(result.assistant_output, "anthropic response");
    assert.equal(result.input_tokens, 11);
    assert.equal(result.output_tokens, 7);
    assert.equal(result.total_tokens, 18);
  });

  it("dispatches direct chat calls to OpenRouter", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    globalThis.fetch = createMockFetch(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "openrouter response",
              },
            },
          ],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 5,
            total_tokens: 14,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const result = await runModelChat({
      model: "claude-sonnet-4-openrouter",
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.equal(result.assistant_output, "openrouter response");
    assert.equal(result.total_tokens, 14);
  });

  it("dispatches batch chat calls to Anthropic", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
    const calls: string[] = [];
    globalThis.fetch = createHandlerFetch(async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);

      if (url.endsWith("/v1/messages/batches") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "msgbatch_test",
            processing_status: "in_progress",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (url.endsWith("/v1/messages/batches/msgbatch_test")) {
        return new Response(
          JSON.stringify({
            id: "msgbatch_test",
            processing_status: "ended",
            results_url:
              "https://api.anthropic.com/v1/messages/batches/msgbatch_test/results",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (url.endsWith("/v1/messages/batches/msgbatch_test/results")) {
        return new Response(
          `${JSON.stringify({
            custom_id: "attempt_1",
            result: {
              type: "succeeded",
              message: {
                content: [
                  { type: "text", text: "anthropic batch response" },
                ],
                usage: {
                  input_tokens: 13,
                  output_tokens: 5,
                },
              },
            },
          })}\n`,
          {
            status: 200,
            headers: {
              "content-type": "application/x-ndjson",
            },
          },
        );
      }

      throw new Error(`Unexpected fetch call: ${init?.method ?? "GET"} ${url}`);
    });

    const result = await runModelBatchChat({
      model: "claude-sonnet-4",
      items: [
        {
          customId: "attempt_1",
          model: "claude-sonnet-4",
          systemPrompt: "system",
          userPrompt: "user",
          metadata: { targetId: "attempt_1" },
        },
      ],
      settings: {
        ...DEFAULT_BATCH_SETTINGS,
        pollIntervalMs: 1,
        maxWaitMs: 1_000,
        transportMaxAttempts: 1,
      },
    });

    assert.deepEqual(calls, [
      "POST https://api.anthropic.com/v1/messages/batches",
      "GET https://api.anthropic.com/v1/messages/batches/msgbatch_test",
      "GET https://api.anthropic.com/v1/messages/batches/msgbatch_test/results",
    ]);
    assert.equal(result.batchId, "msgbatch_test");
    assert.equal(result.succeeded.length, 1);
    assert.equal(result.succeeded[0]?.assistant_output, "anthropic batch response");
    assert.equal(result.succeeded[0]?.total_tokens, 18);
    assert.equal(result.failed.length, 0);
  });
});
