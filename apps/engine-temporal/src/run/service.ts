import {
  DEFAULT_ENGINE_SETTINGS,
  classifyTaskFailure,
  getModelConfig,
  isBatchableModel,
  resolveEffectiveBatchConstraints,
  resolveProviderBatchConstraints,
  type ModelType,
  resolveAttemptLimitForFailureClass,
  shouldUseBatching,
  type EngineSettings,
} from "@judge-gym/engine-settings";
import { Context } from "@temporalio/activity";
import type {
  RunStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import {
  runModelBatchChat,
  runModelChat,
  type BatchChatFailure,
  type BatchChatCreatedEvent,
  type BatchChatLifecycleEvent,
  type ChatResult,
} from "../llm/client";
import { estimateTextTokens, getQuotaStore, type QuotaStore } from "../quota";

type RunStageInput = {
  target_type: "sample" | "sample_score_target";
  target_id: string;
  model: ModelType;
  system_prompt: string;
  user_prompt: string;
  metadata_json: string | null;
};

type RunStageDependencies = {
  convex: Pick<
    ConvexWorkerClient,
    | "getRunExecutionContext"
    | "listRunStageInputs"
    | "recordLlmAttemptStart"
    | "recordLlmAttemptFinish"
    | "applyRunStageResult"
    | "markRunStageFailure"
    | "finalizeRunStage"
    | "markRunProcessError"
  > & {
    recordProcessHeartbeat?: ConvexWorkerClient["recordProcessHeartbeat"];
    ensureBatchExecution?: ConvexWorkerClient["ensureBatchExecution"];
    recordBatchExecutionPreparationProgress?: ConvexWorkerClient["recordBatchExecutionPreparationProgress"];
    bindBatchExecutionSubmitted?: ConvexWorkerClient["bindBatchExecutionSubmitted"];
    finalizeBatchExecution?: ConvexWorkerClient["finalizeBatchExecution"];
  };
  runOpenAiChat: typeof runModelChat;
  runOpenAiBatchChat?: typeof runModelBatchChat;
  quota: QuotaStore;
  settings?: EngineSettings;
  processHeartbeatIntervalMs?: number;
  temporalHeartbeat?: (details?: unknown) => void;
};

type RunAttemptFailureState = {
  attemptId: string;
  message: string;
  attemptsUsed: number;
  maxAttempts: number;
};

type BatchExecutionRecord = {
  batch_execution_id: string;
  provider_batch_id: string | null;
  status: string;
  output_file_id?: string | null;
  error_file_id?: string | null;
  attempt_recorded_count?: number | null;
  attempt_records_json?: string | null;
};

type StartedRunBatchAttempt = {
  input: RunStageInput;
  attemptId: string;
  estimatedInputTokens: number;
};

type RunBatchMetadata = {
  input: RunStageInput;
  attemptId: string;
};

type RunBatchResult = Awaited<ReturnType<typeof runModelBatchChat<RunBatchMetadata>>>;

const DEFAULT_PROCESS_HEARTBEAT_INTERVAL_MS = 30_000;

function getSettings(deps: RunStageDependencies) {
  return deps.settings ?? DEFAULT_ENGINE_SETTINGS;
}

function getBatchExecutor(deps: RunStageDependencies) {
  return deps.runOpenAiBatchChat ?? runModelBatchChat;
}

function getProcessHeartbeatIntervalMs(deps: RunStageDependencies) {
  return deps.processHeartbeatIntervalMs ?? DEFAULT_PROCESS_HEARTBEAT_INTERVAL_MS;
}

function getLlmPreflightTimeoutMs(deps: RunStageDependencies) {
  return getSettings(deps).llm.preflightTimeoutMs;
}

function getBatchAttemptStartConcurrency(settings: EngineSettings) {
  return Math.max(
    2,
    Math.min(8, settings.llm.direct.maxConcurrentRequests * 2),
  );
}

function getBatchAttemptStartPageSize(settings: EngineSettings) {
  const concurrency = getBatchAttemptStartConcurrency(settings);
  return Math.max(concurrency, Math.min(32, concurrency * 2));
}

function getDefaultRunStageDependencies(): RunStageDependencies {
  return {
    convex: getConvexWorkerClient(),
    runOpenAiChat: runModelChat,
    runOpenAiBatchChat: runModelBatchChat,
    quota: getQuotaStore(),
    settings: DEFAULT_ENGINE_SETTINGS,
    temporalHeartbeat: (details?: unknown) => {
      try {
        Context.current().heartbeat(details);
      } catch {
        // No live Temporal activity context in tests or direct callers.
      }
    },
  };
}

function buildObservedDimensions(result: ChatResult) {
  return {
    requests: 1,
    input_tokens: result.input_tokens ?? undefined,
    output_tokens: result.output_tokens ?? undefined,
    total_tokens: result.total_tokens ?? undefined,
  };
}

function estimatePromptTokens(input: RunStageInput) {
  return estimateTextTokens(input.system_prompt) + estimateTextTokens(input.user_prompt);
}

function stableHash(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(index);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

function assertRequiredProcessId(value: string, field: "runId" | "windowRunId") {
  if (typeof value === "string" && value.length > 0) {
    return;
  }
  throw new Error(`[temporal.stage_bootstrap] ${field} is required before Convex stage bootstrap`);
}

function buildRunBatchKey(args: {
  runId: string;
  stage: RunStageKey;
  model: string;
  inputs: RunStageInput[];
}) {
  const identity = args.inputs
    .map((input) => `${input.target_type}:${input.target_id}`)
    .sort()
    .join("|");
  return stableHash(`run:${args.runId}:${args.stage}:${args.model}:${identity}`);
}

function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function chunkItemsByBudget<T>(args: {
  items: T[];
  maxItems: number;
  maxBytes: number;
  maxTokens?: number;
  estimateBytes: (item: T) => number;
  estimateTokens?: (item: T) => number;
}): T[][] {
  if (args.items.length === 0) {
    return [];
  }
  const maxItems = args.maxItems > 0 ? args.maxItems : args.items.length;
  const maxBytes = args.maxBytes > 0 ? args.maxBytes : Number.POSITIVE_INFINITY;
  const maxTokens =
    typeof args.maxTokens === "number" && args.maxTokens > 0
      ? args.maxTokens
      : Number.POSITIVE_INFINITY;
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  let currentTokens = 0;

  for (const item of args.items) {
    const estimatedBytes = Math.max(1, args.estimateBytes(item));
    const estimatedTokens = Math.max(1, args.estimateTokens?.(item) ?? 1);
    const wouldOverflowItems = current.length >= maxItems;
    const wouldOverflowBytes =
      current.length > 0 && currentBytes + estimatedBytes > maxBytes;
    const wouldOverflowTokens =
      current.length > 0 && currentTokens + estimatedTokens > maxTokens;
    if (wouldOverflowItems || wouldOverflowBytes || wouldOverflowTokens) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
      currentTokens = 0;
    }
    current.push(item);
    currentBytes += estimatedBytes;
    currentTokens += estimatedTokens;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function estimateBatchRequestBytes(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  metadataJson: string | null;
}) {
  return new TextEncoder().encode(
    JSON.stringify({
      custom_id: "estimate",
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model: args.model,
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userPrompt },
        ],
      },
      metadata_json: args.metadataJson,
    }),
  ).length;
}

async function processConcurrently<T>(
  items: T[],
  maxConcurrent: number,
  handler: (item: T) => Promise<"succeeded" | "failed">,
) {
  const results = await mapConcurrently(items, maxConcurrent, handler);
  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result === "succeeded") {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  return { successCount, failureCount };
}

async function mapConcurrently<T, TResult>(
  items: T[],
  maxConcurrent: number,
  handler: (item: T) => Promise<TResult>,
) {
  const chunks = chunkItems(items, maxConcurrent);
  const results: TResult[] = [];

  for (const chunk of chunks) {
    results.push(...await Promise.all(chunk.map((item) => handler(item))));
  }

  return results;
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeAttemptRecords(
  attemptsByTargetId: Map<string, StartedRunBatchAttempt>,
) {
  return JSON.stringify(
    Array.from(attemptsByTargetId.values())
      .map(({ input, attemptId }) => [input.target_id, attemptId] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function restoreAttemptRecords(args: {
  inputs: RunStageInput[];
  attemptRecordsJson: string | null | undefined;
}) {
  if (!args.attemptRecordsJson) {
    return new Map<string, StartedRunBatchAttempt>();
  }

  const parsed = JSON.parse(args.attemptRecordsJson) as Array<[string, string]>;
  const inputByTargetId = new Map(
    args.inputs.map((input) => [input.target_id, input] as const),
  );
  const restored = new Map<string, StartedRunBatchAttempt>();

  for (const entry of parsed) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      continue;
    }
    const [targetId, attemptId] = entry;
    const input = inputByTargetId.get(targetId);
    if (!input || typeof attemptId !== "string" || attemptId.length === 0) {
      continue;
    }
    restored.set(targetId, {
      input,
      attemptId,
      estimatedInputTokens: estimatePromptTokens(input),
    });
  }

  return restored;
}

async function recordRunBatchAttemptStarts(args: {
  deps: RunStageDependencies;
  runId: string;
  stage: RunStageKey;
  workflowId: string;
  provider: string;
  model: string;
  batchKey: string;
  batchExecutionId: string | null;
  attemptRecordsJson: string | null | undefined;
  inputs: RunStageInput[];
}): Promise<StartedRunBatchAttempt[]> {
  const settings = getSettings(args.deps);
  const attemptStartConcurrency = getBatchAttemptStartConcurrency(settings);
  const attemptStartPageSize = getBatchAttemptStartPageSize(settings);
  const startedAttemptsByTargetId = restoreAttemptRecords({
    inputs: args.inputs,
    attemptRecordsJson: args.attemptRecordsJson,
  });

  const pendingInputs = args.inputs.filter(
    (input) => !startedAttemptsByTargetId.has(input.target_id),
  );
  const pages = chunkItems(pendingInputs, attemptStartPageSize);

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]!;
    const pageResults = await withPreflightGuard({
      intervalMs: getProcessHeartbeatIntervalMs(args.deps),
      timeoutMs: getLlmPreflightTimeoutMs(args.deps),
      timeoutMessage:
        `Timed out checkpointing batch attempts for ${args.stage} run ${args.runId} `
        + `(page ${pageIndex + 1}/${pages.length})`,
      onHeartbeat: async () => {
        await args.deps.convex.recordProcessHeartbeat?.({
          process_kind: "run",
          process_id: args.runId,
          stage: args.stage,
          payload_json: JSON.stringify({
            source: "batch_preamble",
            step: "record_attempt_starts",
            model: args.model,
            item_count: args.inputs.length,
            page_index: pageIndex + 1,
            page_count: pages.length,
            page_item_count: page.length,
            started_count: startedAttemptsByTargetId.size,
            batch_key: args.batchKey,
            batch_execution_id: args.batchExecutionId,
            attempt_start_concurrency: attemptStartConcurrency,
            attempt_start_page_size: attemptStartPageSize,
          }),
        });
      },
      task: () => mapConcurrently(
        page,
        attemptStartConcurrency,
        async (input) => {
          const { attempt_id } = await withTimeout({
            timeoutMs: getLlmPreflightTimeoutMs(args.deps),
            timeoutMessage:
              `Timed out recording batch attempt start for ${args.stage} `
              + `target ${input.target_id}`,
            task: () => args.deps.convex.recordLlmAttemptStart({
              attempt_key: [
                "run",
                args.runId,
                args.stage,
                input.target_id,
                "batch",
              ].join(":"),
              process_kind: "run",
              process_id: args.runId,
              target_type: input.target_type,
              target_id: input.target_id,
              stage: args.stage,
              provider: args.provider,
              model: input.model,
              operation_type: "batch",
              workflow_id: args.workflowId,
              system_prompt: input.system_prompt,
              user_prompt: input.user_prompt,
              metadata_json: input.metadata_json,
            }),
          });
          return {
            input,
            attemptId: attempt_id,
            estimatedInputTokens: estimatePromptTokens(input),
          };
        },
      ),
    });
    for (const started of pageResults) {
      startedAttemptsByTargetId.set(started.input.target_id, started);
    }
    if (args.batchExecutionId && args.deps.convex.recordBatchExecutionPreparationProgress) {
      await args.deps.convex.recordBatchExecutionPreparationProgress({
        batch_execution_id: args.batchExecutionId,
        attempt_recorded_count: startedAttemptsByTargetId.size,
        attempt_records_json: serializeAttemptRecords(startedAttemptsByTargetId),
      });
    }
  }

  return args.inputs.map((input) => {
    const existing = startedAttemptsByTargetId.get(input.target_id);
    if (!existing) {
      throw new Error(
        `Missing batch attempt checkpoint for ${args.stage} target ${input.target_id}`,
      );
    }
    return existing;
  });
}

async function withPeriodicHeartbeat<T>(args: {
  intervalMs: number;
  onHeartbeat?: (() => Promise<void> | void) | undefined;
  temporalHeartbeat?: ((details?: unknown) => void) | undefined;
  temporalHeartbeatPayload?: unknown;
  task: () => Promise<T>;
}) {
  if (!args.onHeartbeat || args.intervalMs <= 0) {
    return args.task();
  }

  let heartbeatInFlight: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (heartbeatInFlight) {
      return;
    }
    heartbeatInFlight = Promise.resolve()
      .then(() => {
        args.temporalHeartbeat?.(args.temporalHeartbeatPayload);
      })
      .then(() => args.onHeartbeat?.())
      .catch((error) => {
        console.warn("[run.stage] process heartbeat failed", String(error));
      })
      .finally(() => {
        heartbeatInFlight = null;
      });
  }, args.intervalMs);
  timer.unref?.();

  try {
    return await args.task();
  } finally {
    clearInterval(timer);
    await heartbeatInFlight;
  }
}

async function withTimeout<T>(args: {
  timeoutMs: number;
  timeoutMessage: string;
  task: () => Promise<T>;
}) {
  if (args.timeoutMs <= 0) {
    return args.task();
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(args.timeoutMessage));
    }, args.timeoutMs);
    timeoutHandle.unref?.();
  });

  try {
    return await Promise.race([args.task(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function withPreflightGuard<T>(args: {
  intervalMs: number;
  timeoutMs: number;
  timeoutMessage: string;
  onHeartbeat?: (() => Promise<void> | void) | undefined;
  temporalHeartbeat?: ((details?: unknown) => void) | undefined;
  temporalHeartbeatPayload?: unknown;
  task: () => Promise<T>;
}) {
  return withPeriodicHeartbeat({
    intervalMs: args.intervalMs,
    onHeartbeat: args.onHeartbeat,
    temporalHeartbeat: args.temporalHeartbeat,
    temporalHeartbeatPayload: args.temporalHeartbeatPayload,
    task: () => withTimeout({
      timeoutMs: args.timeoutMs,
      timeoutMessage: args.timeoutMessage,
      task: args.task,
    }),
  });
}

export async function runRunStageActivityWithDeps(
  deps: RunStageDependencies,
  runId: string,
  stage: RunStageKey,
): Promise<StageActivityResult<RunStageKey>> {
  assertRequiredProcessId(runId, "runId");
  const { convex } = deps;
  const resolvedSettings = getSettings(deps);
  const run = await convex.getRunExecutionContext(runId);
  const inputs = await convex.listRunStageInputs({
    run_id: runId,
    stage,
  });

  let successCount = 0;
  let failureCount = 0;

  const groups = new Map<ModelType, RunStageInput[]>();
  for (const input of inputs) {
    const key = input.model;
    const group = groups.get(key) ?? [];
    group.push(input);
    groups.set(key, group);
  }

  try {
    for (const [model, groupInputs] of groups.entries()) {
      const { provider } = getModelConfig(model);
      const providerBatchConstraints = resolveProviderBatchConstraints(
        resolvedSettings.providers,
        provider,
        model,
      );
      const effectiveBatchConstraints = resolveEffectiveBatchConstraints({
        settings: resolvedSettings.llm.batching,
        providerConstraints: providerBatchConstraints,
      });
      const useBatching = shouldUseBatching({
        batchable: isBatchableModel(model as any),
        itemCount: groupInputs.length,
        settings: resolvedSettings.llm.batching,
      });

      if (!useBatching) {
        const directResults = await processConcurrently(
          groupInputs,
          resolvedSettings.llm.direct.maxConcurrentRequests,
          async (input) => processRunStageInputWithRetries(deps, {
            runId,
            stage,
            input,
            workflowId: run.workflow_id ?? `run:${runId}`,
          }),
        );
        successCount += directResults.successCount;
        failureCount += directResults.failureCount;
        continue;
      }

      const chunks = chunkItemsByBudget({
        items: groupInputs,
        maxItems: effectiveBatchConstraints.maxBatchSize,
        maxBytes: effectiveBatchConstraints.maxBatchRequestBytes,
        maxTokens: effectiveBatchConstraints.maxEnqueuedInputTokensPerBatch,
        estimateBytes: (input) => estimateBatchRequestBytes({
          model,
          systemPrompt: input.system_prompt,
          userPrompt: input.user_prompt,
          metadataJson: input.metadata_json,
        }),
        estimateTokens: (input) => estimatePromptTokens(input),
      });
      for (
        let index = 0;
        index < chunks.length;
        index += resolvedSettings.llm.batching.maxConcurrentBatches
      ) {
        const slice = chunks.slice(
          index,
          index + resolvedSettings.llm.batching.maxConcurrentBatches,
        );
        const results = await Promise.all(
          slice.map((chunk) => processRunStageBatchChunk(deps, {
            runId,
            stage,
            workflowId: run.workflow_id ?? `run:${runId}`,
            model,
            inputs: chunk,
          })),
        );
        for (const result of results) {
          successCount += result.successCount;
          failureCount += result.failureCount;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await convex.markRunProcessError({
      run_id: runId,
      stage,
      error_message: errorMessage,
    });
    return {
      processKind: "run",
      processId: runId,
      stage,
      summary: `run_stage:${stage}:process_error`,
      haltProcess: true,
      terminalExecutionStatus: "failed",
      errorMessage,
    };
  }

  const finalized = await convex.finalizeRunStage({
    run_id: runId,
    stage,
  });

  if (finalized.has_pending) {
    const errorMessage =
      `Run ${runId} still has pending targets after stage ${stage} finalization`;
    await convex.markRunProcessError({
      run_id: runId,
      stage,
      error_message: errorMessage,
    });
    return {
      processKind: "run",
      processId: runId,
      stage,
      summary: `run_stage:${stage}:pending=${finalized.total - finalized.completed - finalized.failed}`,
      haltProcess: true,
      terminalExecutionStatus: "failed",
      errorMessage,
    };
  }

  if (finalized.halt_process) {
    return {
      processKind: "run",
      processId: runId,
      stage,
      summary: `run_stage:${stage}:success=${successCount}:failed=${failureCount}`,
      haltProcess: true,
      terminalExecutionStatus: finalized.terminal_execution_status ?? "failed",
      errorMessage: finalized.error_message,
    };
  }

  return {
    processKind: "run",
    processId: runId,
    stage,
    summary: `run_stage:${stage}:success=${successCount}:failed=${failureCount}:completed=${finalized.completed}`,
  };
}

export async function runRunStageActivity(
  runId: string,
  stage: RunStageKey,
): Promise<StageActivityResult<RunStageKey>> {
  return runRunStageActivityWithDeps(
    getDefaultRunStageDependencies(),
    runId,
    stage,
  );
}

async function processRunStageInputWithRetries(
  deps: RunStageDependencies,
  args: {
    runId: string;
    stage: RunStageKey;
    workflowId: string;
    input: RunStageInput;
    seedFailure?: RunAttemptFailureState;
  },
): Promise<"succeeded" | "failed"> {
  const settings = getSettings(deps);
  let attemptCount = args.seedFailure?.attemptsUsed ?? 0;
  let maxAttempts =
    args.seedFailure?.maxAttempts
    ?? settings.llm.retries.unexpectedFailureMaxAttempts;
  let lastFailure = args.seedFailure ?? null;

  while (attemptCount < maxAttempts) {
    if (lastFailure) {
      await sleep(settings.llm.retries.backoffMs);
    }

    const result = await executeRunChatAttempt(deps, {
      ...args,
      attemptOrdinal: attemptCount + 1,
    });
    if (result.status === "succeeded") {
      return "succeeded";
    }

    attemptCount += 1;
    maxAttempts = result.maxAttempts;
    lastFailure = {
      attemptId: result.attemptId,
      message: result.message,
      attemptsUsed: attemptCount,
      maxAttempts,
    };
  }

  if (!lastFailure) {
    throw new Error("Run stage failed without an attempt record");
  }

  await deps.convex.markRunStageFailure({
    run_id: args.runId,
    target_id: args.input.target_id,
    stage: args.stage,
    attempt_id: lastFailure.attemptId,
    error_message: lastFailure.message,
  });
  return "failed";
}

async function executeRunChatAttempt(
  deps: RunStageDependencies,
  args: {
    runId: string;
    stage: RunStageKey;
    workflowId: string;
    input: RunStageInput;
    attemptOrdinal: number;
  },
): Promise<
  | { status: "succeeded" }
  | {
      status: "failed";
      attemptId: string;
      message: string;
      maxAttempts: number;
    }
> {
  const settings = getSettings(deps);
  const { provider } = getModelConfig(args.input.model);
  const { attempt_id } = await withTimeout({
    timeoutMs: getLlmPreflightTimeoutMs(deps),
    timeoutMessage:
      `Timed out recording direct attempt start for ${args.stage} `
      + `target ${args.input.target_id}`,
    task: () => deps.convex.recordLlmAttemptStart({
      attempt_key: [
        "run",
        args.runId,
        args.stage,
        args.input.target_id,
        `attempt:${args.attemptOrdinal}`,
      ].join(":"),
      process_kind: "run",
      process_id: args.runId,
      target_type: args.input.target_type,
      target_id: args.input.target_id,
      stage: args.stage,
      provider,
      model: args.input.model,
      operation_type: "chat",
      workflow_id: args.workflowId,
      system_prompt: args.input.system_prompt,
      user_prompt: args.input.user_prompt,
      metadata_json: args.input.metadata_json,
    }),
  });

  const reservedDimensions = {
    requests: 1,
    input_tokens: estimatePromptTokens(args.input),
    total_tokens: estimatePromptTokens(args.input),
  };
  let reservation: Awaited<ReturnType<QuotaStore["reserve"]>> | null = null;

  try {
    reservation = await withPreflightGuard({
      intervalMs: getProcessHeartbeatIntervalMs(deps),
      timeoutMs: getLlmPreflightTimeoutMs(deps),
      timeoutMessage:
        `Timed out reserving direct-request quota for ${args.stage} target ${args.input.target_id}`,
      onHeartbeat: async () => {
        await deps.convex.recordProcessHeartbeat?.({
          process_kind: "run",
          process_id: args.runId,
          stage: args.stage,
          payload_json: JSON.stringify({
            source: "direct_preamble",
            step: "quota_reserve",
            attempt_id,
            target_id: args.input.target_id,
            model: args.input.model,
          }),
        });
      },
      temporalHeartbeat: deps.temporalHeartbeat,
      temporalHeartbeatPayload: {
        source: "direct_preamble",
        step: "quota_reserve",
        attempt_id,
        target_id: args.input.target_id,
        model: args.input.model,
      },
      task: () => deps.quota.reserve({
        reservationId: `run:${args.runId}:${args.stage}:${args.input.target_id}:${attempt_id}`,
        provider,
        model: args.input.model,
        operationType: "chat",
        scopeKey: `run:${args.runId}:${args.stage}`,
        dimensions: reservedDimensions,
        processKind: "run",
        processId: args.runId,
        workflowId: args.workflowId,
      }),
    });
    if (!reservation.allowed) {
      throw new Error(
        `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`,
      );
    }

    const result = await withPeriodicHeartbeat({
      intervalMs: getProcessHeartbeatIntervalMs(deps),
      onHeartbeat: async () => {
        await deps.convex.recordProcessHeartbeat?.({
          process_kind: "run",
          process_id: args.runId,
          stage: args.stage,
          payload_json: JSON.stringify({
            source: "direct_request",
            attempt_id,
            target_id: args.input.target_id,
            model: args.input.model,
          }),
        });
      },
      temporalHeartbeat: deps.temporalHeartbeat,
      temporalHeartbeatPayload: {
        source: "direct_request",
        attempt_id,
        target_id: args.input.target_id,
        model: args.input.model,
      },
      task: () => withTimeout({
        timeoutMs: settings.llm.direct.requestTimeoutMs + 5_000,
        timeoutMessage:
          `Timed out running direct request for ${args.stage} `
          + `target ${args.input.target_id}`,
        task: () => deps.runOpenAiChat({
          model: args.input.model,
          systemPrompt: args.input.system_prompt,
          userPrompt: args.input.user_prompt,
          timeoutMs: settings.llm.direct.requestTimeoutMs,
        }),
      }),
    });
    await deps.convex.applyRunStageResult({
      run_id: args.runId,
      target_id: args.input.target_id,
      stage: args.stage,
      attempt_id,
      output: result.assistant_output,
    });
    await deps.convex.recordLlmAttemptFinish({
      attempt_id,
      status: "succeeded",
      assistant_output: result.assistant_output,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      total_tokens: result.total_tokens,
    });
    await deps.quota.settle({
      reservationId: reservation.reservationId,
      provider,
      model: args.input.model,
      operationType: "chat",
      scopeKey: `run:${args.runId}:${args.stage}`,
      reserved: reservedDimensions,
      observed: buildObservedDimensions(result),
      status: "applied",
    });
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (reservation?.allowed) {
      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.input.model,
        operationType: "chat",
        scopeKey: `run:${args.runId}:${args.stage}`,
        reserved: reservedDimensions,
        observed: { requests: 1 },
        status: "failed",
      });
    }
    await deps.convex.recordLlmAttemptFinish({
      attempt_id,
      status: "failed",
      error_message: message,
    });

    return {
      status: "failed",
      attemptId: attempt_id,
      message,
      maxAttempts: resolveAttemptLimitForFailureClass(
        classifyTaskFailure(error),
        settings.llm.retries,
      ),
    };
  }
}

async function processRunStageBatchChunk(
  deps: RunStageDependencies,
  args: {
    runId: string;
    stage: RunStageKey;
    workflowId: string;
    model: ModelType;
    inputs: RunStageInput[];
  },
): Promise<{ successCount: number; failureCount: number }> {
  const settings = getSettings(deps);
  const { provider } = getModelConfig(args.model);
  const batchKey = buildRunBatchKey({
    runId: args.runId,
    stage: args.stage,
    model: args.model,
    inputs: args.inputs,
  });
  let startedAttempts: StartedRunBatchAttempt[] = [];
  let reservation: Awaited<ReturnType<QuotaStore["reserve"]>> | null = null;

  const failureStates = new Map<string, RunAttemptFailureState>();
  let successCount = 0;
  let batchExecution: BatchExecutionRecord | null = null;

  const recordSharedBatchFailure = async (message: string) => {
    await Promise.all(
      startedAttempts.map(async ({ input, attemptId }) => {
        await deps.convex.recordLlmAttemptFinish({
          attempt_id: attemptId,
          status: "failed",
          error_message: message,
        });
        failureStates.set(input.target_id, {
          attemptId,
          message,
          attemptsUsed: 1,
          maxAttempts: resolveAttemptLimitForFailureClass(
            classifyTaskFailure(new Error(message)),
            settings.llm.retries,
          ),
        });
      }),
    );
  };

  try {
    batchExecution = deps.convex.ensureBatchExecution
      ? await withPreflightGuard({
        intervalMs: getProcessHeartbeatIntervalMs(deps),
        timeoutMs: getLlmPreflightTimeoutMs(deps),
        timeoutMessage:
          `Timed out preparing batch execution for ${args.stage} run ${args.runId}`,
        onHeartbeat: async () => {
          await deps.convex.recordProcessHeartbeat?.({
            process_kind: "run",
            process_id: args.runId,
            stage: args.stage,
            payload_json: JSON.stringify({
              source: "batch_preamble",
              step: "ensure_batch_execution",
              model: args.model,
              item_count: args.inputs.length,
              batch_key: batchKey,
            }),
          });
        },
        temporalHeartbeat: deps.temporalHeartbeat,
        temporalHeartbeatPayload: {
          source: "batch_preamble",
          step: "ensure_batch_execution",
          model: args.model,
          item_count: args.inputs.length,
          batch_key: batchKey,
        },
        task: () => deps.convex.ensureBatchExecution!({
          batch_key: batchKey,
          process_kind: "run",
          process_id: args.runId,
          stage: args.stage,
          provider,
          model: args.model,
          workflow_id: args.workflowId,
          item_count: args.inputs.length,
        }),
      })
      : null;

    startedAttempts = await recordRunBatchAttemptStarts({
      deps,
      runId: args.runId,
      stage: args.stage,
      workflowId: args.workflowId,
      provider,
      model: args.model,
      batchKey,
      batchExecutionId: batchExecution?.batch_execution_id ?? null,
      attemptRecordsJson: batchExecution?.attempt_records_json,
      inputs: args.inputs,
    });

    const reservedDimensions = {
      requests: 1,
      batch_enqueued_input_tokens: startedAttempts.reduce(
        (sum, item) => sum + item.estimatedInputTokens,
        0,
      ),
    };

    reservation = await withPreflightGuard({
      intervalMs: getProcessHeartbeatIntervalMs(deps),
      timeoutMs: getLlmPreflightTimeoutMs(deps),
      timeoutMessage:
        `Timed out reserving batch quota for ${args.stage} run ${args.runId}`,
      onHeartbeat: async () => {
        await deps.convex.recordProcessHeartbeat?.({
          process_kind: "run",
          process_id: args.runId,
          stage: args.stage,
          payload_json: JSON.stringify({
            source: "batch_preamble",
            step: "quota_reserve",
            model: args.model,
            item_count: startedAttempts.length,
            batch_key: batchKey,
          }),
        });
      },
      temporalHeartbeat: deps.temporalHeartbeat,
      temporalHeartbeatPayload: {
        source: "batch_preamble",
        step: "quota_reserve",
        model: args.model,
        item_count: startedAttempts.length,
        batch_key: batchKey,
      },
      task: () => deps.quota.reserve({
        reservationId: `run:${args.runId}:${args.stage}:batch:${startedAttempts.map((item) => item.attemptId).join(":")}`,
        provider,
        model: args.model,
        operationType: "batch",
        scopeKey: `run:${args.runId}:${args.stage}`,
        dimensions: reservedDimensions,
        processKind: "run",
        processId: args.runId,
        workflowId: args.workflowId,
      }),
    });
    if (!reservation.allowed) {
      const message =
        `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`;
      await recordSharedBatchFailure(message);
    } else {
      const batch: RunBatchResult = await withPeriodicHeartbeat({
        intervalMs: getProcessHeartbeatIntervalMs(deps),
        onHeartbeat: async () => {
          await deps.convex.recordProcessHeartbeat?.({
            process_kind: "run",
            process_id: args.runId,
            stage: args.stage,
            payload_json: JSON.stringify({
              source: "batch_wait",
              model: args.model,
              item_count: startedAttempts.length,
              batch_key: batchKey,
            }),
          });
        },
        temporalHeartbeat: deps.temporalHeartbeat,
        temporalHeartbeatPayload: {
          source: "batch_wait",
          model: args.model,
          item_count: startedAttempts.length,
          batch_key: batchKey,
        },
        task: () => getBatchExecutor(deps)<RunBatchMetadata>({
          model: args.model,
          existingBatchId: batchExecution?.provider_batch_id ?? undefined,
          items: startedAttempts.map(({ input, attemptId }) => ({
            customId: attemptId,
            model: input.model,
            systemPrompt: input.system_prompt,
            userPrompt: input.user_prompt,
            metadata: { input, attemptId },
          })),
          settings: settings.llm.batching,
          timeoutMs: settings.llm.batching.requestTimeoutMs,
          onBatchCreated: async (event: BatchChatCreatedEvent) => {
            await deps.convex.bindBatchExecutionSubmitted?.({
              batch_execution_id: batchExecution!.batch_execution_id,
              provider_batch_id: event.batchId,
              input_file_id: event.inputFileId ?? null,
              provider_status: event.status,
            });
          },
          onLifecycleEvent: async (event: BatchChatLifecycleEvent) => {
            if (batchExecution) {
              await deps.convex.finalizeBatchExecution?.({
                batch_execution_id: batchExecution.batch_execution_id,
                status: "submitted",
                provider_status: event.status,
              });
            }
            await deps.convex.recordProcessHeartbeat?.({
              process_kind: "run",
              process_id: args.runId,
              stage: args.stage,
              event_name: `batch_${event.phase}`,
              payload_json: JSON.stringify({
                batch_id: event.batchId,
                status: event.status,
                model: args.model,
                item_count: startedAttempts.length,
              }),
            });
          },
        }),
      });

      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.model,
        operationType: "batch",
        scopeKey: `run:${args.runId}:${args.stage}`,
        reserved: reservedDimensions,
        observed: {
          requests: 1,
          batch_enqueued_input_tokens: reservedDimensions.batch_enqueued_input_tokens,
        },
        status: "applied",
      });
      if (batchExecution) {
        await deps.convex.finalizeBatchExecution?.({
          batch_execution_id: batchExecution.batch_execution_id,
          status: "submitted",
          provider_status: "completed",
          output_file_id: batch.outputFileId,
          error_file_id: batch.errorFileId,
          provider_artifacts_json: batch.providerArtifactsJson ?? null,
        });
      }

      for (const item of batch.succeeded) {
        try {
          await deps.convex.applyRunStageResult({
            run_id: args.runId,
            target_id: item.metadata.input.target_id,
            stage: args.stage,
            attempt_id: item.metadata.attemptId,
            output: item.assistant_output,
          });
          await deps.convex.recordLlmAttemptFinish({
            attempt_id: item.metadata.attemptId,
            status: "succeeded",
            assistant_output: item.assistant_output,
            input_tokens: item.input_tokens,
            output_tokens: item.output_tokens,
            total_tokens: item.total_tokens,
          });
          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await deps.convex.recordLlmAttemptFinish({
            attempt_id: item.metadata.attemptId,
            status: "failed",
            error_message: message,
          });
          failureStates.set(item.metadata.input.target_id, {
            attemptId: item.metadata.attemptId,
            message,
            attemptsUsed: 1,
            maxAttempts: resolveAttemptLimitForFailureClass(
              classifyTaskFailure(error),
              settings.llm.retries,
            ),
          });
        }
      }

      for (const item of batch.failed) {
        await handleRunBatchFailureItem(
          deps,
          failureStates,
          item,
        );
      }
    }
  } catch (error) {
    const reservedDimensions = {
      requests: 1,
      batch_enqueued_input_tokens: startedAttempts.reduce(
        (sum, item) => sum + item.estimatedInputTokens,
        0,
      ),
    };
    if (reservation?.allowed) {
      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.model,
        operationType: "batch",
        scopeKey: `run:${args.runId}:${args.stage}`,
        reserved: reservedDimensions,
        observed: { requests: 1 },
        status: "failed",
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    await deps.convex.recordProcessHeartbeat?.({
      process_kind: "run",
      process_id: args.runId,
      stage: args.stage,
      payload_json: JSON.stringify({
        source: "batch_preamble",
        step: "failed",
        model: args.model,
        item_count: args.inputs.length,
        started_count: startedAttempts.length,
        batch_key: batchKey,
        error_message: message,
      }),
    });
    let existingBatchExecution = batchExecution;
    if (!existingBatchExecution && deps.convex.ensureBatchExecution) {
      try {
        existingBatchExecution = await withPreflightGuard({
          intervalMs: getProcessHeartbeatIntervalMs(deps),
          timeoutMs: getLlmPreflightTimeoutMs(deps),
          timeoutMessage:
            `Timed out recovering batch execution for ${args.stage} run ${args.runId}`,
          onHeartbeat: async () => {
            await deps.convex.recordProcessHeartbeat?.({
              process_kind: "run",
              process_id: args.runId,
              stage: args.stage,
              payload_json: JSON.stringify({
                source: "batch_preamble",
                step: "recover_batch_execution",
                model: args.model,
                item_count: startedAttempts.length,
                batch_key: batchKey,
              }),
            });
          },
          temporalHeartbeat: deps.temporalHeartbeat,
          temporalHeartbeatPayload: {
            source: "batch_preamble",
            step: "recover_batch_execution",
            model: args.model,
            item_count: startedAttempts.length,
            batch_key: batchKey,
          },
          task: () => deps.convex.ensureBatchExecution!({
            batch_key: batchKey,
            process_kind: "run",
            process_id: args.runId,
            stage: args.stage,
            provider,
            model: args.model,
            workflow_id: args.workflowId,
            item_count: startedAttempts.length,
          }),
        });
      } catch (recoveryError) {
        console.warn(
          "[run.stage] failed to recover batch execution after batch preamble error",
          String(recoveryError),
        );
      }
    }
    if (existingBatchExecution) {
      await deps.convex.finalizeBatchExecution?.({
        batch_execution_id: existingBatchExecution.batch_execution_id,
        status: "failed",
        provider_status: "failed",
        provider_artifacts_json: null,
        error_message: message,
      });
    }
    await recordSharedBatchFailure(message);
    throw error;
  }

  if (!reservation?.allowed) {
    // no-op; handled by shared failure path
  }

  let failureCount = 0;
  for (const { input } of startedAttempts) {
    const failure = failureStates.get(input.target_id);
    if (!failure) {
      continue;
    }
    const result = await processRunStageInputWithRetries(deps, {
      runId: args.runId,
      stage: args.stage,
      workflowId: args.workflowId,
      input,
      seedFailure: failure,
    });
    if (result === "succeeded") {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  if (reservation?.allowed && batchExecution) {
    await deps.convex.finalizeBatchExecution?.({
      batch_execution_id: batchExecution.batch_execution_id,
      status: failureCount > 0 ? "failed" : "completed",
      provider_status: "completed",
      error_message: failureCount > 0
        ? `${failureCount} target(s) still failed after reconciliation`
        : null,
    });
  }

  return { successCount, failureCount };
}

async function handleRunBatchFailureItem(
  deps: RunStageDependencies,
  failureStates: Map<string, RunAttemptFailureState>,
  item: BatchChatFailure<{
    input: RunStageInput;
    attemptId: string;
  }>,
) {
  const settings = getSettings(deps);
  await deps.convex.recordLlmAttemptFinish({
    attempt_id: item.metadata.attemptId,
    status: "failed",
    error_message: item.error_message,
  });
  failureStates.set(item.metadata.input.target_id, {
    attemptId: item.metadata.attemptId,
    message: item.error_message,
    attemptsUsed: 1,
    maxAttempts: resolveAttemptLimitForFailureClass(
      classifyTaskFailure(new Error(item.error_message)),
      settings.llm.retries,
    ),
  });
}
