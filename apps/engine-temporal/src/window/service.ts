import {
  DEFAULT_ENGINE_SETTINGS,
  classifyTaskFailure,
  isBatchableModel,
  resolveAttemptLimitForFailureClass,
  shouldUseBatching,
  type EngineSettings,
} from "@judge-gym/engine-settings";
import type {
  StageActivityResult,
  WindowStageKey,
} from "@judge-gym/engine-settings/process";
import {
  abstractPrompt,
  CLEANING_INSTRUCTIONS,
  cleanPrompt,
  NEUTRALIZE_INSTRUCTIONS,
  STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
  neutralizePrompt,
} from "@judge-gym/engine-prompts/window";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import {
  runOpenAiBatchChat,
  runOpenAiChat,
  type BatchChatFailure,
  type ChatResult,
} from "../llm/openai";
import { estimateTextTokens, getQuotaStore, type QuotaStore } from "../quota";
import { getModelConfig } from "./model_registry";

type SearchResult = {
  title: string;
  url: string;
  raw_content: string;
};

type WindowTransformStage = Exclude<WindowStageKey, "collect">;

type WindowStageDependencies = {
  convex: Pick<
    ConvexWorkerClient,
    | "getWindowExecutionContext"
    | "insertWindowEvidenceBatch"
    | "listWindowStageInputs"
    | "recordLlmAttemptStart"
    | "recordLlmAttemptFinish"
    | "applyWindowStageResult"
    | "markWindowStageFailure"
    | "markWindowNoEvidence"
    | "markWindowProcessError"
  >;
  searchWindowEvidence: typeof searchWindowEvidence;
  runOpenAiChat: typeof runOpenAiChat;
  runOpenAiBatchChat?: typeof runOpenAiBatchChat;
  quota: QuotaStore;
  settings?: EngineSettings;
};

type WindowStageInput = {
  evidence_id: string;
  title: string;
  url: string;
  input: string;
};

type PreparedWindowStageInput = WindowStageInput & {
  normalizedInput: string;
};

type WindowAttemptFailureState = {
  attemptId: string;
  message: string;
  attemptsUsed: number;
  maxAttempts: number;
};

function getSettings(deps: WindowStageDependencies) {
  return deps.settings ?? DEFAULT_ENGINE_SETTINGS;
}

function getBatchExecutor(deps: WindowStageDependencies) {
  return deps.runOpenAiBatchChat ?? runOpenAiBatchChat;
}

const WINDOW_STAGE_PROMPTS: Record<
  WindowTransformStage,
  {
    systemPrompt: string;
    buildPrompt: (input: string) => string;
  }
> = {
  l1_cleaned: {
    systemPrompt: CLEANING_INSTRUCTIONS,
    buildPrompt: cleanPrompt,
  },
  l2_neutralized: {
    systemPrompt: NEUTRALIZE_INSTRUCTIONS,
    buildPrompt: neutralizePrompt,
  },
  l3_abstracted: {
    systemPrompt: STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
    buildPrompt: abstractPrompt,
  },
};

export async function searchWindowEvidence(args: {
  query: string;
  country: string;
  start_date: string;
  end_date: string;
  limit: number;
}): Promise<SearchResult[]> {
  const startedAt = Date.now();
  const convex = getConvexWorkerClient();

  console.info("[window.collect] firecrawl search start", {
    query: args.query,
    country: args.country,
    limit: args.limit,
    start_date: args.start_date,
    end_date: args.end_date,
  });

  const items = await convex.searchWindowEvidence(args);
  console.info("[window.collect] firecrawl search finish", {
    query: args.query,
    returned: items.length,
    elapsed_ms: Date.now() - startedAt,
  });
  return items
    .filter(
      (item: any) =>
        typeof item?.raw_content === "string"
        && item.raw_content.trim().length > 0
        && typeof item?.title === "string"
        && item.title.trim().length > 0
        && typeof item?.url === "string"
        && item.url.trim().length > 0,
    )
    .map((item: any) => ({
      title: item.title as string,
      url: item.url as string,
      raw_content: item.raw_content as string,
    }));
}

function getDefaultWindowStageDependencies(): WindowStageDependencies {
  return {
    convex: getConvexWorkerClient(),
    searchWindowEvidence,
    runOpenAiChat,
    runOpenAiBatchChat,
    quota: getQuotaStore(),
    settings: DEFAULT_ENGINE_SETTINGS,
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

function normalizeWindowStageInput(
  input: string,
  maxChars: number,
) {
  const trimmed = input.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const suffix = "\n\n[Truncated for window semantic processing]";
  const sliceLength = Math.max(1, maxChars - suffix.length);
  return `${trimmed.slice(0, sliceLength)}${suffix}`;
}

function estimatePromptTokens(args: {
  systemPrompt: string;
  userPrompt: string;
}) {
  return estimateTextTokens(args.systemPrompt) + estimateTextTokens(args.userPrompt);
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

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWindowStageActivityWithDeps(
  deps: WindowStageDependencies,
  windowRunId: string,
  stage: WindowStageKey,
): Promise<StageActivityResult<WindowStageKey>> {
  const { convex } = deps;
  const settings = getSettings(deps);
  const window = await convex.getWindowExecutionContext(windowRunId);

  if (stage === "collect") {
    let evidences: SearchResult[];
    try {
      evidences = await retryWindowCollectionSearch(
        deps.searchWindowEvidence,
        settings,
        {
          query: window.query,
          country: window.country,
          start_date: window.start_date,
          end_date: window.end_date,
          limit: window.target_count,
        },
      );
    } catch (error) {
      console.error("[window.collect] firecrawl search failed", {
        window_run_id: windowRunId,
        query: window.query,
        country: window.country,
        limit: window.target_count,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (evidences.length === 0) {
      await convex.markWindowNoEvidence({
        window_run_id: windowRunId,
      });
      return {
        processKind: "window",
        processId: windowRunId,
        stage,
        summary: "window_collect:no_evidence",
        haltProcess: true,
        terminalExecutionStatus: "completed",
      };
    }

    const result = await convex.insertWindowEvidenceBatch({
      window_run_id: windowRunId,
      evidences,
    });
    return {
      processKind: "window",
      processId: windowRunId,
      stage,
      summary: `window_collect:inserted=${result.inserted}:total=${result.total}`,
    };
  }

  const stageConfig = WINDOW_STAGE_PROMPTS[stage];
  const rawInputs = await convex.listWindowStageInputs({
    window_run_id: windowRunId,
    stage,
  });
  const inputs: PreparedWindowStageInput[] = rawInputs.map((input) => ({
    ...input,
    normalizedInput: normalizeWindowStageInput(
      input.input,
      settings.window.maxStageInputChars,
    ),
  }));

  if (inputs.length === 0) {
    return {
      processKind: "window",
      processId: windowRunId,
      stage,
      summary: `window_stage:${stage}:noop`,
    };
  }

  let successCount = 0;
  let failureCount = 0;

  const useBatching = shouldUseBatching({
    batchable: isBatchableModel(window.model as any),
    itemCount: inputs.length,
    settings: settings.llm.batching,
  });

  if (!useBatching) {
    for (const item of inputs) {
      const taskResult = await processWindowStageInputWithRetries(deps, {
        windowRunId,
        stage,
        windowModel: window.model,
        workflowId: window.workflow_id ?? `window:${windowRunId}`,
        evidenceId: item.evidence_id,
        evidenceTitle: item.title,
        evidenceUrl: item.url,
        systemPrompt: stageConfig.systemPrompt,
        userPrompt: stageConfig.buildPrompt(item.normalizedInput),
      });

      if (taskResult === "succeeded") {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }
  } else {
    const chunks = chunkItems(inputs, settings.llm.batching.maxBatchSize);
    for (
      let index = 0;
      index < chunks.length;
      index += settings.llm.batching.maxConcurrentBatches
    ) {
      const slice = chunks.slice(
        index,
        index + settings.llm.batching.maxConcurrentBatches,
      );
      const results = await Promise.all(
        slice.map((chunk) => processWindowStageBatchChunk(deps, {
          windowRunId,
          stage,
          windowModel: window.model,
          workflowId: window.workflow_id ?? `window:${windowRunId}`,
          inputs: chunk,
          systemPrompt: stageConfig.systemPrompt,
        })),
      );

      for (const result of results) {
        successCount += result.successCount;
        failureCount += result.failureCount;
      }
    }
  }

  if (successCount === 0 && failureCount > 0) {
    const errorMessage = `All ${stage} attempts failed for window run ${windowRunId}`;
    await convex.markWindowProcessError({
      window_run_id: windowRunId,
      stage,
      error_message: errorMessage,
    });
    return {
      processKind: "window",
      processId: windowRunId,
      stage,
      summary: `window_stage:${stage}:failed=${failureCount}`,
      haltProcess: true,
      terminalExecutionStatus: "failed",
      errorMessage,
    };
  }

  return {
    processKind: "window",
    processId: windowRunId,
    stage,
    summary: `window_stage:${stage}:success=${successCount}:failed=${failureCount}`,
  };
}

export async function runWindowStageActivity(
  windowRunId: string,
  stage: WindowStageKey,
): Promise<StageActivityResult<WindowStageKey>> {
  return runWindowStageActivityWithDeps(
    getDefaultWindowStageDependencies(),
    windowRunId,
    stage,
  );
}

async function processWindowStageInputWithRetries(
  deps: WindowStageDependencies,
  args: {
    windowRunId: string;
    stage: WindowTransformStage;
    windowModel: string;
    workflowId: string;
    evidenceId: string;
    evidenceTitle: string;
    evidenceUrl: string;
    systemPrompt: string;
    userPrompt: string;
    seedFailure?: WindowAttemptFailureState;
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

    const result = await executeWindowChatAttempt(deps, args);
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
    throw new Error("Window stage failed without an attempt record");
  }

  await deps.convex.markWindowStageFailure({
    window_run_id: args.windowRunId,
    evidence_id: args.evidenceId,
    stage: args.stage,
    attempt_id: lastFailure.attemptId,
    error_message: lastFailure.message,
  });
  return "failed";
}

async function executeWindowChatAttempt(
  deps: WindowStageDependencies,
  args: {
    windowRunId: string;
    stage: WindowTransformStage;
    windowModel: string;
    workflowId: string;
    evidenceId: string;
    evidenceTitle: string;
    evidenceUrl: string;
    systemPrompt: string;
    userPrompt: string;
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
  const { provider } = getModelConfig(args.windowModel);
  const { attempt_id } = await deps.convex.recordLlmAttemptStart({
    process_kind: "window",
    process_id: args.windowRunId,
    target_type: "evidence",
    target_id: args.evidenceId,
    stage: args.stage,
    provider,
    model: args.windowModel,
    operation_type: "chat",
    workflow_id: args.workflowId,
    system_prompt: args.systemPrompt,
    user_prompt: args.userPrompt,
    metadata_json: JSON.stringify({
      evidence_title: args.evidenceTitle,
      evidence_url: args.evidenceUrl,
    }),
  });

  const reservedDimensions = {
    requests: 1,
    input_tokens: estimatePromptTokens(args),
    total_tokens: estimatePromptTokens(args),
  };
  const reservation = await deps.quota.reserve({
    reservationId:
      `window:${args.windowRunId}:${args.stage}:${args.evidenceId}:${attempt_id}`,
    provider,
    model: args.windowModel,
    operationType: "chat",
    scopeKey: `window:${args.windowRunId}:${args.stage}`,
    dimensions: reservedDimensions,
    processKind: "window",
    processId: args.windowRunId,
    workflowId: args.workflowId,
  });

  try {
    if (!reservation.allowed) {
      throw new Error(
        `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`,
      );
    }

    const result = await deps.runOpenAiChat({
      model: args.windowModel,
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      timeoutMs: settings.llm.requestTimeoutMs,
    });
    await deps.convex.applyWindowStageResult({
      window_run_id: args.windowRunId,
      evidence_id: args.evidenceId,
      stage: args.stage,
      attempt_id,
      output: result.assistant_output,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      total_tokens: result.total_tokens,
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
      model: args.windowModel,
      operationType: "chat",
      scopeKey: `window:${args.windowRunId}:${args.stage}`,
      reserved: reservedDimensions,
      observed: buildObservedDimensions(result),
      status: "applied",
    });
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (reservation.allowed) {
      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.windowModel,
        operationType: "chat",
        scopeKey: `window:${args.windowRunId}:${args.stage}`,
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

async function processWindowStageBatchChunk(
  deps: WindowStageDependencies,
  args: {
    windowRunId: string;
    stage: WindowTransformStage;
    windowModel: string;
    workflowId: string;
    inputs: PreparedWindowStageInput[];
    systemPrompt: string;
  },
): Promise<{ successCount: number; failureCount: number }> {
  const settings = getSettings(deps);
  const { provider } = getModelConfig(args.windowModel);
  const startedAttempts = await Promise.all(
    args.inputs.map(async (input) => {
      const userPrompt = WINDOW_STAGE_PROMPTS[args.stage].buildPrompt(
        input.normalizedInput,
      );
      const { attempt_id } = await deps.convex.recordLlmAttemptStart({
        process_kind: "window",
        process_id: args.windowRunId,
        target_type: "evidence",
        target_id: input.evidence_id,
        stage: args.stage,
        provider,
        model: args.windowModel,
        operation_type: "batch",
        workflow_id: args.workflowId,
        system_prompt: args.systemPrompt,
        user_prompt: userPrompt,
        metadata_json: JSON.stringify({
          evidence_title: input.title,
          evidence_url: input.url,
        }),
      });
      return {
        input,
        userPrompt,
        attemptId: attempt_id,
        estimatedInputTokens: estimatePromptTokens({
          systemPrompt: args.systemPrompt,
          userPrompt,
        }),
      };
    }),
  );

  const reservedDimensions = {
    requests: 1,
    batch_enqueued_input_tokens: startedAttempts.reduce(
      (sum, item) => sum + item.estimatedInputTokens,
      0,
    ),
  };

  const reservation = await deps.quota.reserve({
    reservationId:
      `window:${args.windowRunId}:${args.stage}:batch:${startedAttempts.map((item) => item.attemptId).join(":")}`,
    provider,
    model: args.windowModel,
    operationType: "batch",
    scopeKey: `window:${args.windowRunId}:${args.stage}`,
    dimensions: reservedDimensions,
    processKind: "window",
    processId: args.windowRunId,
    workflowId: args.workflowId,
  });

  const failureStates = new Map<string, WindowAttemptFailureState>();
  let successCount = 0;

  const recordSharedBatchFailure = async (message: string) => {
    await Promise.all(
      startedAttempts.map(async ({ input, attemptId }) => {
        await deps.convex.recordLlmAttemptFinish({
          attempt_id: attemptId,
          status: "failed",
          error_message: message,
        });
        failureStates.set(input.evidence_id, {
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
    if (!reservation.allowed) {
      const message =
        `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`;
      await recordSharedBatchFailure(message);
    } else {
      const batch = await getBatchExecutor(deps)({
        model: args.windowModel,
        items: startedAttempts.map(({ input, userPrompt, attemptId }) => ({
          customId: attemptId,
          model: args.windowModel,
          systemPrompt: args.systemPrompt,
          userPrompt,
          metadata: { input, userPrompt, attemptId },
        })),
        settings: settings.llm.batching,
        timeoutMs: settings.llm.requestTimeoutMs,
      });

      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.windowModel,
        operationType: "batch",
        scopeKey: `window:${args.windowRunId}:${args.stage}`,
        reserved: reservedDimensions,
        observed: {
          requests: 1,
          batch_enqueued_input_tokens: reservedDimensions.batch_enqueued_input_tokens,
        },
        status: "applied",
      });

      for (const item of batch.succeeded) {
        try {
          await deps.convex.applyWindowStageResult({
            window_run_id: args.windowRunId,
            evidence_id: item.metadata.input.evidence_id,
            stage: args.stage,
            attempt_id: item.metadata.attemptId,
            output: item.assistant_output,
            input_tokens: item.input_tokens,
            output_tokens: item.output_tokens,
            total_tokens: item.total_tokens,
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
          failureStates.set(item.metadata.input.evidence_id, {
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
        await handleWindowBatchFailureItem(deps, failureStates, item);
      }
    }
  } catch (error) {
    if (reservation.allowed) {
      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.windowModel,
        operationType: "batch",
        scopeKey: `window:${args.windowRunId}:${args.stage}`,
        reserved: reservedDimensions,
        observed: { requests: 1 },
        status: "failed",
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    await recordSharedBatchFailure(message);
  }

  let failureCount = 0;
  for (const { input, userPrompt } of startedAttempts) {
    const failure = failureStates.get(input.evidence_id);
    if (!failure) {
      continue;
    }
    const result = await processWindowStageInputWithRetries(deps, {
      windowRunId: args.windowRunId,
      stage: args.stage,
      windowModel: args.windowModel,
      workflowId: args.workflowId,
      evidenceId: input.evidence_id,
      evidenceTitle: input.title,
      evidenceUrl: input.url,
      systemPrompt: args.systemPrompt,
      userPrompt,
      seedFailure: failure,
    });
    if (result === "succeeded") {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  return { successCount, failureCount };
}

async function handleWindowBatchFailureItem(
  deps: WindowStageDependencies,
  failureStates: Map<string, WindowAttemptFailureState>,
  item: BatchChatFailure<{
    input: WindowStageInput;
    userPrompt: string;
    attemptId: string;
  }>,
) {
  const settings = getSettings(deps);
  await deps.convex.recordLlmAttemptFinish({
    attempt_id: item.metadata.attemptId,
    status: "failed",
    error_message: item.error_message,
  });
  failureStates.set(item.metadata.input.evidence_id, {
    attemptId: item.metadata.attemptId,
    message: item.error_message,
    attemptsUsed: 1,
    maxAttempts: resolveAttemptLimitForFailureClass(
      classifyTaskFailure(new Error(item.error_message)),
      settings.llm.retries,
    ),
  });
}

async function retryWindowCollectionSearch(
  search: typeof searchWindowEvidence,
  settings: EngineSettings,
  args: {
    query: string;
    country: string;
    start_date: string;
    end_date: string;
    limit: number;
  },
): Promise<SearchResult[]> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= settings.window.firecrawl.maxAttempts; attempt += 1) {
    try {
      return await search(args);
    } catch (error) {
      lastError = error;
      if (attempt >= settings.window.firecrawl.maxAttempts) {
        break;
      }
      await sleep(settings.window.firecrawl.retryBackoffMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Window collection failed"));
}
