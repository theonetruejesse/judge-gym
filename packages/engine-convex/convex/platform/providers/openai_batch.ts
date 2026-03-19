import { getProviderModel, type ModelType } from "./provider_types";

type BatchRequestInput = {
  custom_key: string;
  model: ModelType;
  system_prompt?: string;
  user_prompt: string;
  max_tokens?: number;
};

type BatchMetadata = {
  engine_batch_id: string;
  engine_submission_id: string;
};

type BatchSubmitResult = {
  batch_ref: string;
  input_file_id: string;
};

type BatchLookupResult = {
  batch_ref: string;
  input_file_id?: string;
  status: string;
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

const OPENAI_BATCH_RUNNING_STATUSES = new Set([
  "validating",
  "in_progress",
  "finalizing",
  "cancelling",
]);

const OPENAI_BATCH_ERROR_STATUSES = new Set([
  "failed",
  "expired",
  "cancelled",
]);

export function normalizeOpenAiBatchStatus(rawStatus: unknown): BatchPollResult {
  const status = String(rawStatus ?? "").toLowerCase();
  if (status === "completed") {
    throw new Error("normalizeOpenAiBatchStatus cannot normalize completed status");
  }
  if (OPENAI_BATCH_RUNNING_STATUSES.has(status)) {
    return { status: "running" };
  }
  if (OPENAI_BATCH_ERROR_STATUSES.has(status)) {
    return {
      status: "error",
      error: `batch_${status}`,
    };
  }
  return {
    status: "error",
    error: status ? `batch_unknown_status:${status}` : "batch_missing_status",
  };
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";

type ParsedBatchRow = {
  custom_key: string;
  status: "completed" | "error";
  output?: {
    assistant_output: string;
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: string;
};

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
        model: getProviderModel(req.model),
        messages,
      };
      if (req.max_tokens !== undefined) body.max_completion_tokens = req.max_tokens;

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

function extractAssistantOutput(choiceContent: unknown): string {
  if (typeof choiceContent === "string") return choiceContent;
  if (!Array.isArray(choiceContent)) return "";
  return choiceContent
    .map((part) => {
      if (typeof part === "string") return part;
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
      return "";
    })
    .join("");
}

function parseBatchRows(
  content: string,
  fallbackStatus: "completed" | "error",
): ParsedBatchRow[] {
  const parsed: ParsedBatchRow[] = [];
  const rows = content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

  for (const row of rows) {
    const customKey = typeof row.custom_id === "string" ? row.custom_id : "";
    if (!customKey) continue;

    if (row.error) {
      parsed.push({
        custom_key: customKey,
        status: "error",
        error: row.error?.message ?? "provider_error",
      });
      continue;
    }

    const response = row.response ?? row;
    const body = response.body ?? {};
    const statusCode =
      typeof response.status_code === "number" ? response.status_code : null;
    if (statusCode !== null && statusCode >= 400) {
      parsed.push({
        custom_key: customKey,
        status: "error",
        error: body?.error?.message ?? `provider_http_${statusCode}`,
      });
      continue;
    }

    const choice = body.choices?.[0]?.message;
    const output = extractAssistantOutput(choice?.content);
    if (fallbackStatus === "error" && output.length === 0) {
      parsed.push({
        custom_key: customKey,
        status: "error",
        error: body?.error?.message ?? "provider_error",
      });
      continue;
    }

    parsed.push({
      custom_key: customKey,
      status: "completed",
      output: {
        assistant_output: output,
        input_tokens: body.usage?.prompt_tokens,
        output_tokens: body.usage?.completion_tokens,
      },
    });
  }

  return parsed;
}

export async function submitOpenAiBatch(
  requests: BatchRequestInput[],
  metadata: BatchMetadata,
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
      metadata,
    }),
  });

  return {
    batch_ref: batchResp.id as string,
    input_file_id: fileId,
  };
}

export async function findOpenAiBatchByMetadata(
  metadata: BatchMetadata,
  limit = 100,
): Promise<BatchLookupResult | null> {
  const apiKey = requireKey();
  const query = new URLSearchParams({ limit: String(limit) });
  const payload = await fetchJson(`${OPENAI_BASE_URL}/batches?${query.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const rows: Array<Record<string, unknown>> = Array.isArray(payload.data)
    ? payload.data as Array<Record<string, unknown>>
    : [];
  const matched = rows.find((row) => {
    const rowMetadata = typeof row.metadata === "object" && row.metadata !== null
      ? row.metadata as Record<string, unknown>
      : {};
    return rowMetadata.engine_batch_id === metadata.engine_batch_id
      && rowMetadata.engine_submission_id === metadata.engine_submission_id;
  });

  if (!matched) return null;
  return {
    batch_ref: String(matched.id),
    input_file_id: typeof matched.input_file_id === "string" ? matched.input_file_id : undefined,
    status: String(matched.status ?? "unknown"),
  };
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
    return normalizeOpenAiBatchStatus(status);
  }

  const outputFileId = batch.output_file_id as string | undefined;
  const errorFileId = batch.error_file_id as string | undefined;
  if (!outputFileId && !errorFileId) {
    return { status: "error", error: "missing_output_and_error_file" };
  }

  const mergedByKey = new Map<string, ParsedBatchRow>();

  if (outputFileId) {
    const outputContent = await fetchText(
      `${OPENAI_BASE_URL}/files/${outputFileId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    for (const row of parseBatchRows(outputContent, "completed")) {
      mergedByKey.set(row.custom_key, row);
    }
  }

  if (errorFileId) {
    const errorContent = await fetchText(
      `${OPENAI_BASE_URL}/files/${errorFileId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    for (const row of parseBatchRows(errorContent, "error")) {
      const existing = mergedByKey.get(row.custom_key);
      if (!existing || row.status === "error") {
        mergedByKey.set(row.custom_key, row);
      }
    }
  }

  return {
    status: "completed",
    results: Array.from(mergedByKey.values()),
  };
}
