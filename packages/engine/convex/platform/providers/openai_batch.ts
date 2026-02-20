type BatchRequestInput = {
  custom_key: string;
  model: string;
  system_prompt?: string;
  user_prompt: string;
  max_tokens?: number;
};

type BatchSubmitResult = {
  batch_ref: string;
};

type BatchPollResult =
  | { status: "running" }
  | { status: "error"; error: string }
  | {
      status: "completed";
      results: Array<{
        custom_key: string;
        status: "completed" | "error";
        output?: {
          assistant_output: string;
          input_tokens?: number;
          output_tokens?: number;
        };
        error?: string;
      }>;
    };

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
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
      if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;

      return JSON.stringify({
        custom_id: req.custom_key,
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

export async function submitOpenAiBatch(
  requests: BatchRequestInput[],
): Promise<BatchSubmitResult> {
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

  return { batch_ref: batchResp.id as string };
}

export async function pollOpenAiBatch(
  batchRef: string,
): Promise<BatchPollResult> {
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
    } as BatchPollResult;
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
        custom_key: row.custom_id,
        status: "error" as const,
        error: row.error?.message ?? "provider_error",
      };
    }
    const response = row.response ?? row;
    const body = response.body ?? {};
    const choice = body.choices?.[0]?.message;
    const output = choice?.content ?? "";
    return {
      custom_key: row.custom_id,
      status: "completed" as const,
      output: {
        assistant_output: output,
        input_tokens: body.usage?.prompt_tokens,
        output_tokens: body.usage?.completion_tokens,
      },
    };
  });

  return { status: "completed", results: parsed };
}
