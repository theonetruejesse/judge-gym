import type { BatchSettings } from "@judge-gym/engine-settings/batch";
import { getModelConfig } from "../window/model_registry";
import type {
  BatchChatCreatedEvent,
  BatchChatFailure,
  BatchChatLifecycleEvent,
  BatchChatRequest,
  BatchChatSuccess,
  ChatResult,
} from "./client";

const ANTHROPIC_API_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4_096;

type AnthropicBatchLifecycle = {
  id: string;
  processing_status: "in_progress" | "canceling" | "ended" | string;
  results_url?: string | null;
};

function requireAnthropicKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return key;
}

async function anthropicRequest(
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
  return fetch(`${ANTHROPIC_API_BASE}${path}`, {
    ...init,
    signal,
    headers: {
      "anthropic-version": ANTHROPIC_VERSION,
      "x-api-key": requireAnthropicKey(),
      ...(init.headers ?? {}),
    },
  });
}

async function anthropicRequestUrl(
  url: string,
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
  return fetch(url, {
    ...init,
    signal,
    headers: {
      "anthropic-version": ANTHROPIC_VERSION,
      "x-api-key": requireAnthropicKey(),
      ...(init.headers ?? {}),
    },
  });
}

function parseAnthropicTextContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (
        item
        && typeof item === "object"
        && "type" in item
        && (item as { type?: unknown }).type === "text"
        && "text" in item
        && typeof (item as { text?: unknown }).text === "string"
      ) {
        return (item as { text: string }).text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildAnthropicMessageBody(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const { providerModel } = getModelConfig(args.model);
  return {
    model: providerModel,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: args.systemPrompt,
    messages: [
      {
        role: "user",
        content: args.userPrompt,
      },
    ],
  };
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry<T>(args: {
  attempts: number;
  backoffMs: number;
  fn: () => Promise<T>;
}) {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < args.attempts) {
    try {
      return await args.fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= args.attempts) {
        break;
      }
      await sleep(args.backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseJsonl(text: string): Array<Record<string, unknown>> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function createAnthropicBatch<TMetadata>(args: {
  model: string;
  items: Array<BatchChatRequest<TMetadata>>;
  timeoutMs?: number;
}): Promise<AnthropicBatchLifecycle> {
  const response = await anthropicRequest("/v1/messages/batches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: args.items.map((item) => ({
        custom_id: item.customId,
        params: buildAnthropicMessageBody({
          model: args.model,
          systemPrompt: item.systemPrompt,
          userPrompt: item.userPrompt,
        }),
      })),
    }),
  }, args.timeoutMs);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic batch create error ${response.status}: ${bodyText}`);
  }
  const body = bodyText ? JSON.parse(bodyText) : {};
  if (!body.id) {
    throw new Error("Anthropic batch create did not return an id");
  }
  return body as AnthropicBatchLifecycle;
}

async function getAnthropicBatch(
  batchId: string,
  timeoutMs?: number,
): Promise<AnthropicBatchLifecycle> {
  const response = await anthropicRequest(`/v1/messages/batches/${batchId}`, {
    method: "GET",
  }, timeoutMs);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic batch poll error ${response.status}: ${bodyText}`);
  }
  return bodyText
    ? (JSON.parse(bodyText) as AnthropicBatchLifecycle)
    : {
        id: batchId,
        processing_status: "in_progress",
      };
}

async function getAnthropicBatchResults(
  resultsUrl: string,
  timeoutMs?: number,
): Promise<string> {
  const response = await anthropicRequestUrl(resultsUrl, {
    method: "GET",
  }, timeoutMs);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic batch results error ${response.status}: ${bodyText}`);
  }
  return bodyText;
}

function describeAnthropicBatchResult(line: Record<string, unknown>): string {
  const result = line.result as {
    type?: unknown;
    error?: { message?: unknown; type?: unknown } | undefined;
  } | undefined;
  if (
    result?.error
    && typeof result.error === "object"
    && typeof result.error.message === "string"
  ) {
    return result.error.message;
  }
  if (typeof result?.type === "string") {
    return `Anthropic batch request ended with status ${result.type}`;
  }
  return JSON.stringify(line);
}

export async function runAnthropicChat(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const response = await anthropicRequest("/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildAnthropicMessageBody(args)),
  }, args.timeoutMs);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${bodyText}`);
  }
  const body = bodyText ? JSON.parse(bodyText) : {};

  const input_tokens = body.usage?.input_tokens ?? null;
  const output_tokens = body.usage?.output_tokens ?? null;
  return {
    assistant_output: parseAnthropicTextContent(body.content),
    input_tokens,
    output_tokens,
    total_tokens:
      typeof input_tokens === "number" && typeof output_tokens === "number"
        ? input_tokens + output_tokens
        : null,
  };
}

export async function runAnthropicBatchChat<TMetadata>(args: {
  model: string;
  items: Array<BatchChatRequest<TMetadata>>;
  settings: BatchSettings;
  timeoutMs?: number;
  existingBatchId?: string;
  onBatchCreated?: (event: BatchChatCreatedEvent) => Promise<void> | void;
  onLifecycleEvent?: (event: BatchChatLifecycleEvent) => Promise<void> | void;
}): Promise<{
  batchId: string;
  outputFileId: string | null;
  errorFileId: string | null;
  providerArtifactsJson?: string | null;
  succeeded: Array<BatchChatSuccess<TMetadata>>;
  failed: Array<BatchChatFailure<TMetadata>>;
}> {
  if (args.items.length === 0) {
    return {
      batchId: "batch:none",
      outputFileId: null,
      errorFileId: null,
      providerArtifactsJson: null,
      succeeded: [],
      failed: [],
    };
  }

  const itemByCustomId = new Map(
    args.items.map((item) => [item.customId, item] as const),
  );
  let lifecycle = args.existingBatchId
    ? await getAnthropicBatch(args.existingBatchId, args.timeoutMs)
    : await createAnthropicBatch(args);

  if (!args.existingBatchId) {
    await args.onBatchCreated?.({
      batchId: lifecycle.id,
      inputFileId: null,
      status: lifecycle.processing_status,
    });
  }

  await args.onLifecycleEvent?.({
    phase: "submitted",
    batchId: lifecycle.id,
    status: lifecycle.processing_status,
  });

  const startedAt = Date.now();
  while (lifecycle.processing_status !== "ended") {
    if (Date.now() - startedAt > args.settings.maxWaitMs) {
      throw new Error(
        `Anthropic batch ${lifecycle.id} exceeded max wait of ${args.settings.maxWaitMs}ms`,
      );
    }

    await sleep(args.settings.pollIntervalMs);
    lifecycle = await runWithRetry({
      attempts: args.settings.transportMaxAttempts,
      backoffMs: args.settings.transportBackoffMs,
      fn: () => getAnthropicBatch(lifecycle.id, args.timeoutMs),
    });
    await args.onLifecycleEvent?.({
      phase: "polled",
      batchId: lifecycle.id,
      status: lifecycle.processing_status,
    });
  }

  await args.onLifecycleEvent?.({
    phase: "completed",
    batchId: lifecycle.id,
    status: lifecycle.processing_status,
  });

  if (!lifecycle.results_url) {
    throw new Error(`Anthropic batch ${lifecycle.id} completed without a results_url`);
  }

  const resultLines = parseJsonl(
    await runWithRetry({
      attempts: args.settings.transportMaxAttempts,
      backoffMs: args.settings.transportBackoffMs,
      fn: () => getAnthropicBatchResults(lifecycle.results_url!, args.timeoutMs),
    }),
  );
  const succeeded: Array<BatchChatSuccess<TMetadata>> = [];
  const failed: Array<BatchChatFailure<TMetadata>> = [];

  for (const line of resultLines) {
    const customId = line.custom_id;
    if (typeof customId !== "string") {
      continue;
    }
    const item = itemByCustomId.get(customId);
    if (!item) {
      continue;
    }

    const result = line.result as {
      type?: unknown;
      message?: {
        content?: unknown;
        usage?: {
          input_tokens?: number | null;
          output_tokens?: number | null;
        };
      } | undefined;
      error?: { message?: unknown } | undefined;
    } | undefined;

    if (result?.type !== "succeeded" || !result.message) {
      failed.push({
        customId,
        metadata: item.metadata,
        batchId: lifecycle.id,
        error_message: describeAnthropicBatchResult(line),
      });
      continue;
    }

    const input_tokens = result.message.usage?.input_tokens ?? null;
    const output_tokens = result.message.usage?.output_tokens ?? null;
    succeeded.push({
      customId,
      metadata: item.metadata,
      batchId: lifecycle.id,
      assistant_output: parseAnthropicTextContent(result.message.content),
      input_tokens,
      output_tokens,
      total_tokens:
        typeof input_tokens === "number" && typeof output_tokens === "number"
          ? input_tokens + output_tokens
          : null,
    });
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
      error_message: `Anthropic batch ${lifecycle.id} returned no result for ${item.customId}`,
    });
  }

  return {
    batchId: lifecycle.id,
    outputFileId: null,
    errorFileId: null,
    providerArtifactsJson: JSON.stringify({
      results_url: lifecycle.results_url,
    }),
    succeeded,
    failed,
  };
}
