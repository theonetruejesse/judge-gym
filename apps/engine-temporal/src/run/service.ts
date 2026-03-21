import {
  DEFAULT_ENGINE_SETTINGS,
  classifyTaskFailure,
  isBatchableModel,
  resolveAttemptLimitForFailureClass,
  shouldUseBatching,
  type EngineSettings,
} from "@judge-gym/engine-settings";
import type {
  RunStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import {
  runOpenAiBatchChat,
  runOpenAiChat,
  type BatchChatFailure,
  type ChatResult,
} from "../llm/openai";
import { estimateTextTokens, getQuotaStore, type QuotaStore } from "../quota";
import { getModelConfig } from "../window/model_registry";

type RunStageInput = {
  target_type: "sample" | "sample_score_target";
  target_id: string;
  model: string;
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
  };
  runOpenAiChat: typeof runOpenAiChat;
  runOpenAiBatchChat?: typeof runOpenAiBatchChat;
  quota: QuotaStore;
  settings?: EngineSettings;
};

type RunAttemptFailureState = {
  attemptId: string;
  message: string;
  attemptsUsed: number;
  maxAttempts: number;
};

function getSettings(deps: RunStageDependencies) {
  return deps.settings ?? DEFAULT_ENGINE_SETTINGS;
}

function getBatchExecutor(deps: RunStageDependencies) {
  return deps.runOpenAiBatchChat ?? runOpenAiBatchChat;
}

function getDefaultRunStageDependencies(): RunStageDependencies {
  return {
    convex: getConvexWorkerClient(),
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

function estimatePromptTokens(input: RunStageInput) {
  return estimateTextTokens(input.system_prompt) + estimateTextTokens(input.user_prompt);
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

async function processConcurrently<T>(
  items: T[],
  maxConcurrent: number,
  handler: (item: T) => Promise<"succeeded" | "failed">,
) {
  const chunks = chunkItems(items, maxConcurrent);
  let successCount = 0;
  let failureCount = 0;

  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map((item) => handler(item)));
    for (const result of results) {
      if (result === "succeeded") {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }
  }

  return { successCount, failureCount };
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runRunStageActivityWithDeps(
  deps: RunStageDependencies,
  runId: string,
  stage: RunStageKey,
): Promise<StageActivityResult<RunStageKey>> {
  const { convex } = deps;
  const resolvedSettings = getSettings(deps);
  const run = await convex.getRunExecutionContext(runId);
  const inputs = await convex.listRunStageInputs({
    run_id: runId,
    stage,
  });

  let successCount = 0;
  let failureCount = 0;

  const groups = new Map<string, RunStageInput[]>();
  for (const input of inputs) {
    const key = input.model;
    const group = groups.get(key) ?? [];
    group.push(input);
    groups.set(key, group);
  }

  for (const [model, groupInputs] of groups.entries()) {
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

    const chunks = chunkItems(
      groupInputs,
      resolvedSettings.llm.batching.maxBatchSize,
    );
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

    const result = await executeRunChatAttempt(deps, args);
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
  const { attempt_id } = await deps.convex.recordLlmAttemptStart({
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
  });

  const reservedDimensions = {
    requests: 1,
    input_tokens: estimatePromptTokens(args.input),
    total_tokens: estimatePromptTokens(args.input),
  };
  const reservation = await deps.quota.reserve({
    reservationId: `run:${args.runId}:${args.stage}:${args.input.target_id}:${attempt_id}`,
    provider,
    model: args.input.model,
    operationType: "chat",
    scopeKey: `run:${args.runId}:${args.stage}`,
    dimensions: reservedDimensions,
    processKind: "run",
    processId: args.runId,
    workflowId: args.workflowId,
  });

  try {
    if (!reservation.allowed) {
      throw new Error(
        `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`,
      );
    }

    const result = await deps.runOpenAiChat({
      model: args.input.model,
      systemPrompt: args.input.system_prompt,
      userPrompt: args.input.user_prompt,
      timeoutMs: settings.llm.requestTimeoutMs,
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
    if (reservation.allowed) {
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
    model: string;
    inputs: RunStageInput[];
  },
): Promise<{ successCount: number; failureCount: number }> {
  const settings = getSettings(deps);
  const { provider } = getModelConfig(args.model);
  const startedAttempts = await Promise.all(
    args.inputs.map(async (input) => {
      const { attempt_id } = await deps.convex.recordLlmAttemptStart({
        process_kind: "run",
        process_id: args.runId,
        target_type: input.target_type,
        target_id: input.target_id,
        stage: args.stage,
        provider,
        model: input.model,
        operation_type: "batch",
        workflow_id: args.workflowId,
        system_prompt: input.system_prompt,
        user_prompt: input.user_prompt,
        metadata_json: input.metadata_json,
      });
      return {
        input,
        attemptId: attempt_id,
        estimatedInputTokens: estimatePromptTokens(input),
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
    reservationId: `run:${args.runId}:${args.stage}:batch:${startedAttempts.map((item) => item.attemptId).join(":")}`,
    provider,
    model: args.model,
    operationType: "batch",
    scopeKey: `run:${args.runId}:${args.stage}`,
    dimensions: reservedDimensions,
    processKind: "run",
    processId: args.runId,
    workflowId: args.workflowId,
  });

  const failureStates = new Map<string, RunAttemptFailureState>();
  let successCount = 0;

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
    if (!reservation.allowed) {
      const message =
        `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`;
      await recordSharedBatchFailure(message);
    } else {
      const batch = await getBatchExecutor(deps)({
        model: args.model,
        items: startedAttempts.map(({ input, attemptId }) => ({
          customId: attemptId,
          model: input.model,
          systemPrompt: input.system_prompt,
          userPrompt: input.user_prompt,
          metadata: { input, attemptId },
        })),
        settings: settings.llm.batching,
        timeoutMs: settings.llm.requestTimeoutMs,
        onLifecycleEvent: async (event) => {
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
    if (reservation.allowed) {
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
    await recordSharedBatchFailure(message);
  }

  if (!reservation.allowed) {
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
