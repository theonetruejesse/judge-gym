import type {
  BatchAdapter,
  BatchPollResult,
  BatchRequestInput,
  BatchSubmitResult,
} from "../utils/batch_adapter_registry";
import { env } from "../../env";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function requireKey() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for OpenAI batch calls");
  }
  return env.OPENAI_API_KEY;
}

function toJsonl(requests: BatchRequestInput[]): string {
  return requests
    .map((req) => {
      const messages = [] as Array<{ role: string; content: string }>;
      if (req.system_prompt) {
        messages.push({ role: "system", content: req.system_prompt });
      }
      messages.push({ role: "user", content: req.user_prompt });

      const body: Record<string, unknown> = {
        model: req.model,
        messages,
      };
      if (req.temperature !== undefined) body.temperature = req.temperature;
      if (req.top_p !== undefined) body.top_p = req.top_p;
      if (req.seed !== undefined) body.seed = req.seed;
      if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;
      if (req.stop !== undefined) body.stop = req.stop;

      return JSON.stringify({
        custom_id: req.custom_id,
        method: "POST",
        url: "/v1/chat/completions",
        body,
      });
    })
    .join("\n");
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function fetchText(url: string, init: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  return text;
}

export const openaiBatchAdapter: BatchAdapter = {
  async submitBatch(requests: BatchRequestInput[]): Promise<BatchSubmitResult> {
    const apiKey = requireKey();
    const jsonl = toJsonl(requests);

    const form = new FormData();
    form.set("purpose", "batch");
    form.set(
      "file",
      new Blob([jsonl], { type: "application/jsonl" }),
      "batch.jsonl",
    );

    const fileResp = await fetchJson(`${OPENAI_BASE_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const fileId = fileResp.id as string;
    const batchResp = await fetchJson(`${OPENAI_BASE_URL}/batches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_file_id: fileId,
        endpoint: "/v1/chat/completions",
        completion_window: "24h",
      }),
    });

    return {
      batch_ref: batchResp.id as string,
      completion_window: batchResp.completion_window as string,
    };
  },

  async pollBatch(batchRef: string): Promise<BatchPollResult> {
    const apiKey = requireKey();
    const batch = await fetchJson(`${OPENAI_BASE_URL}/batches/${batchRef}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const status = String(batch.status ?? "").toLowerCase();
    if (status !== "completed") {
      return {
        status: status === "failed" ? "error" : "running",
        error: status === "failed" ? "batch_failed" : undefined,
      };
    }

    const outputFileId = batch.output_file_id as string | undefined;
    if (!outputFileId) {
      return { status: "error", error: "missing_output_file" };
    }

    const content = await fetchText(
      `${OPENAI_BASE_URL}/files/${outputFileId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    const results = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    const parsed = results.map((row: any) => {
      if (row.error) {
        return {
          custom_id: row.custom_id,
          status: "error" as const,
          error: row.error?.message ?? "provider_error",
        };
      }
      const response = row.response ?? row;
      const body = response.body ?? {};
      const choice = body.choices?.[0]?.message;
      const output = choice?.content ?? "";
      return {
        custom_id: row.custom_id,
        status: "completed" as const,
        output: {
          assistant_output: output,
          input_tokens: body.usage?.prompt_tokens,
          output_tokens: body.usage?.completion_tokens,
          total_tokens: body.usage?.total_tokens,
        },
      };
    });

    return { status: "completed", results: parsed };
  },

  async cancelBatch(batchRef: string): Promise<void> {
    const apiKey = requireKey();
    await fetchJson(`${OPENAI_BASE_URL}/batches/${batchRef}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  },
};
