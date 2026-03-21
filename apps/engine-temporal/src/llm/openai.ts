import type { BatchSettings } from "@judge-gym/engine-settings/batch";
import { getModelConfig } from "../window/model_registry";

export type ChatResult = {
  assistant_output: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

export type BatchChatRequest<TMetadata = Record<string, unknown>> = {
  customId: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  metadata: TMetadata;
};

export type BatchChatSuccess<TMetadata = Record<string, unknown>> =
  ChatResult
  & {
    customId: string;
    metadata: TMetadata;
    batchId: string;
  };

export type BatchChatFailure<TMetadata = Record<string, unknown>> = {
  customId: string;
  metadata: TMetadata;
  batchId: string;
  error_message: string;
};

type BatchLifecycleResponse = {
  id: string;
  status: string;
  output_file_id?: string | null;
  error_file_id?: string | null;
};

function requireOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

async function openAiRequest(
  path: string,
  init: RequestInit,
  timeoutMs?: number,
) {
  const timeoutSignal =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  const signal =
    init.signal && timeoutSignal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : (init.signal ?? timeoutSignal);
  const response = await fetch(`https://api.openai.com${path}`, {
    ...init,
    signal,
    headers: {
      Authorization: `Bearer ${requireOpenAiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  return response;
}

function parseAssistantOutput(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          part
          && typeof part === "object"
          && "text" in part
          && typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function buildChatCompletionBody(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const { providerModel } = getModelConfig(args.model);

  return {
    model: providerModel,
    messages: [
      {
        role: "system",
        content: args.systemPrompt,
      },
      {
        role: "user",
        content: args.userPrompt,
      },
    ],
  };
}

export async function runOpenAiChat(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const response = await openAiRequest("/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildChatCompletionBody(args),
    ),
  }, args.timeoutMs);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${bodyText}`);
  }
  const body = bodyText ? JSON.parse(bodyText) : {};

  return {
    assistant_output: parseAssistantOutput(body.choices?.[0]?.message?.content),
    input_tokens: body.usage?.prompt_tokens ?? null,
    output_tokens: body.usage?.completion_tokens ?? null,
    total_tokens: body.usage?.total_tokens ?? null,
  };
}

async function createBatchInputFile(
  body: string,
  timeoutMs?: number,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("purpose", "batch");
  form.append(
    "file",
    new Blob([body], { type: "application/jsonl" }),
    "judge-gym-batch.jsonl",
  );

  const response = await openAiRequest("/v1/files", {
    method: "POST",
    body: form,
  }, timeoutMs);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI file upload error ${response.status}: ${bodyText}`);
  }

  const json = bodyText ? JSON.parse(bodyText) : {};
  if (!json.id) {
    throw new Error("OpenAI file upload did not return an id");
  }
  return { id: json.id };
}

async function createBatch(args: {
  inputFileId: string;
  settings: BatchSettings;
  timeoutMs?: number;
}) {
  const response = await openAiRequest("/v1/batches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input_file_id: args.inputFileId,
      endpoint: "/v1/chat/completions",
      completion_window: args.settings.completionWindow,
    }),
  }, args.timeoutMs);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI batch create error ${response.status}: ${bodyText}`);
  }

  const json = bodyText ? JSON.parse(bodyText) : {};
  if (!json.id) {
    throw new Error("OpenAI batch create did not return an id");
  }
  return json as BatchLifecycleResponse;
}

async function getBatch(
  batchId: string,
  timeoutMs?: number,
): Promise<BatchLifecycleResponse> {
  const response = await openAiRequest(`/v1/batches/${batchId}`, {
    method: "GET",
  }, timeoutMs);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI batch poll error ${response.status}: ${bodyText}`);
  }
  return bodyText ? JSON.parse(bodyText) : { id: batchId, status: "unknown" };
}

async function getFileContent(
  fileId: string,
  timeoutMs?: number,
): Promise<string> {
  const response = await openAiRequest(`/v1/files/${fileId}/content`, {
    method: "GET",
  }, timeoutMs);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI file content error ${response.status}: ${bodyText}`);
  }
  return bodyText;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonl(text: string): Array<Record<string, unknown>> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function describeBatchLineError(line: Record<string, unknown>): string {
  const response = line.response as { status_code?: number; body?: unknown } | undefined;
  const error = line.error as { message?: unknown; code?: unknown } | undefined;
  if (error?.message && typeof error.message === "string") {
    return error.message;
  }
  if (response?.status_code && response.status_code >= 400) {
    return `OpenAI batch response ${response.status_code}: ${JSON.stringify(response.body ?? {})}`;
  }
  return JSON.stringify(error ?? response ?? { error: "unknown_batch_error" });
}

export async function runOpenAiBatchChat<TMetadata>(args: {
  model: string;
  items: Array<BatchChatRequest<TMetadata>>;
  settings: BatchSettings;
  timeoutMs?: number;
  existingBatchId?: string;
  onBatchCreated?: (event: {
    batchId: string;
    inputFileId: string;
    status: string;
  }) => Promise<void> | void;
  onLifecycleEvent?: (event: {
    phase: "submitted" | "polled" | "completed";
    batchId: string;
    status: string;
  }) => Promise<void> | void;
}): Promise<{
  batchId: string;
  outputFileId: string | null;
  errorFileId: string | null;
  succeeded: Array<BatchChatSuccess<TMetadata>>;
  failed: Array<BatchChatFailure<TMetadata>>;
}> {
  if (args.items.length === 0) {
    return {
      batchId: "batch:none",
      outputFileId: null,
      errorFileId: null,
      succeeded: [],
      failed: [],
    };
  }

  const itemByCustomId = new Map(
    args.items.map((item) => [item.customId, item] as const),
  );
  let batch: BatchLifecycleResponse;
  if (args.existingBatchId) {
    batch = await getBatch(args.existingBatchId, args.timeoutMs);
  } else {
    const inputBody = args.items.map((item) => {
      return JSON.stringify({
        custom_id: item.customId,
        method: "POST",
        url: "/v1/chat/completions",
        body: buildChatCompletionBody({
          model: args.model,
          systemPrompt: item.systemPrompt,
          userPrompt: item.userPrompt,
        }),
      });
    }).join("\n");

    const inputFile = await createBatchInputFile(inputBody, args.timeoutMs);
    batch = await createBatch({
      inputFileId: inputFile.id,
      settings: args.settings,
      timeoutMs: args.timeoutMs,
    });
    await args.onBatchCreated?.({
      batchId: batch.id,
      inputFileId: inputFile.id,
      status: batch.status,
    });
  }
  await args.onLifecycleEvent?.({
    phase: "submitted",
    batchId: batch.id,
    status: batch.status,
  });

  const startedAt = Date.now();
  let lifecycle = batch;

  while (true) {
    if (lifecycle.status === "completed") {
      break;
    }

    if (
      lifecycle.status === "failed"
      || lifecycle.status === "expired"
      || lifecycle.status === "cancelled"
    ) {
      throw new Error(
        `OpenAI batch ${lifecycle.id} ended with terminal status ${lifecycle.status}`,
      );
    }

    if (Date.now() - startedAt > args.settings.maxWaitMs) {
      throw new Error(
        `OpenAI batch ${lifecycle.id} exceeded max wait of ${args.settings.maxWaitMs}ms`,
      );
    }

    await sleep(args.settings.pollIntervalMs);
    lifecycle = await getBatch(batch.id, args.timeoutMs);
    await args.onLifecycleEvent?.({
      phase: "polled",
      batchId: lifecycle.id,
      status: lifecycle.status,
    });
  }
  await args.onLifecycleEvent?.({
    phase: "completed",
    batchId: lifecycle.id,
    status: lifecycle.status,
  });

  const succeeded: Array<BatchChatSuccess<TMetadata>> = [];
  const failed: Array<BatchChatFailure<TMetadata>> = [];

  if (lifecycle.output_file_id) {
    const outputLines = parseJsonl(
      await getFileContent(lifecycle.output_file_id, args.timeoutMs),
    );
    for (const line of outputLines) {
      const customId = line.custom_id;
      if (typeof customId !== "string") {
        continue;
      }
      const item = itemByCustomId.get(customId);
      if (!item) {
        continue;
      }

      const response = line.response as {
        status_code?: number;
        body?: {
          choices?: Array<{
            message?: {
              content?: unknown;
            };
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };
      } | undefined;

      if (!response || (response.status_code ?? 500) >= 400) {
        failed.push({
          customId,
          metadata: item.metadata,
          batchId: lifecycle.id,
          error_message: describeBatchLineError(line),
        });
        continue;
      }

      succeeded.push({
        customId,
        metadata: item.metadata,
        batchId: lifecycle.id,
        assistant_output: parseAssistantOutput(
          response.body?.choices?.[0]?.message?.content,
        ),
        input_tokens: response.body?.usage?.prompt_tokens ?? null,
        output_tokens: response.body?.usage?.completion_tokens ?? null,
        total_tokens: response.body?.usage?.total_tokens ?? null,
      });
    }
  }

  if (lifecycle.error_file_id) {
    const errorLines = parseJsonl(
      await getFileContent(lifecycle.error_file_id, args.timeoutMs),
    );
    for (const line of errorLines) {
      const customId = line.custom_id;
      if (typeof customId !== "string") {
        continue;
      }
      const item = itemByCustomId.get(customId);
      if (!item) {
        continue;
      }

      failed.push({
        customId,
        metadata: item.metadata,
        batchId: lifecycle.id,
        error_message: describeBatchLineError(line),
      });
    }
  }

  const seenCustomIds = new Set([
    ...succeeded.map((item) => item.customId),
    ...failed.map((item) => item.customId),
  ]);

  for (const item of args.items) {
    if (seenCustomIds.has(item.customId)) {
      continue;
    }
    failed.push({
      customId: item.customId,
      metadata: item.metadata,
      batchId: lifecycle.id,
      error_message: `OpenAI batch ${lifecycle.id} returned no result for ${item.customId}`,
    });
  }

  return {
    batchId: lifecycle.id,
    outputFileId: lifecycle.output_file_id ?? null,
    errorFileId: lifecycle.error_file_id ?? null,
    succeeded,
    failed,
  };
}
