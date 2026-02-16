import type {
  BatchAdapter,
  BatchPollResult,
  BatchRequestInput,
  BatchSubmitResult,
} from "../utils/batch_adapter_registry";
import { requireEnv } from "../../env";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

function requireKey() {
  return requireEnv("ANTHROPIC_API_KEY");
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function fetchText(url: string, init: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  return text;
}

export const anthropicBatchAdapter: BatchAdapter = {
  async submitBatch(requests: BatchRequestInput[]): Promise<BatchSubmitResult> {
    const apiKey = requireKey();

    const payload = {
      requests: requests.map((req) => ({
        custom_id: req.custom_id,
        params: {
          model: req.model,
          max_tokens: req.max_tokens ?? 5000,
          temperature: req.temperature,
          top_p: req.top_p,
          system: req.system_prompt,
          messages: [{ role: "user", content: req.user_prompt }],
        },
      })),
    };

    const batch = await fetchJson(`${ANTHROPIC_BASE_URL}/messages/batches`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return {
      batch_ref: batch.id as string,
      completion_window: batch.completion_window as string,
    };
  },

  async pollBatch(batchRef: string): Promise<BatchPollResult> {
    const apiKey = requireKey();
    const batch = await fetchJson(
      `${ANTHROPIC_BASE_URL}/messages/batches/${batchRef}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      },
    );

    const status = String(batch.processing_status ?? "").toLowerCase();
    if (status !== "ended" && status !== "completed") {
      return {
        status: status === "failed" ? "error" : "running",
        error: status === "failed" ? "batch_failed" : undefined,
      };
    }

    const resultsUrl = batch.results_url as string | undefined;
    if (!resultsUrl) {
      return { status: "error", error: "missing_results_url" };
    }

    const content = await fetchText(resultsUrl, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    const results = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    const parsed = results.map((row: any) => {
      const result = row.result ?? row;
      if (result.type === "errored") {
        return {
          custom_id: row.custom_id,
          status: "error" as const,
          error: result.error?.message ?? "provider_error",
        };
      }
      const message = result.message ?? result;
      const contentBlock = message.content?.[0];
      const output = contentBlock?.text ?? "";
      return {
        custom_id: row.custom_id,
        status: "completed" as const,
        output: {
          assistant_output: output,
          input_tokens: message.usage?.input_tokens,
          output_tokens: message.usage?.output_tokens,
          total_tokens: message.usage?.total_tokens,
        },
      };
    });

    return { status: "completed", results: parsed };
  },

  async cancelBatch(_batchRef: string): Promise<void> {
    throw new Error("Anthropic batch cancellation not implemented");
  },
};
