import type {
  RunStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import {
  DEFAULT_ENGINE_SETTINGS,
  classifyTaskFailure,
  resolveAttemptLimitForFailureClass,
} from "@judge-gym/engine-settings";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import { estimateTextTokens, getQuotaStore, type QuotaStore } from "../quota";
import { getModelConfig } from "../window/model_registry";
import { runOpenAiChat } from "../window/service";

const RETRY_SETTINGS = DEFAULT_ENGINE_SETTINGS.llm.retries;

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
  >;
  runOpenAiChat: typeof runOpenAiChat;
  quota: QuotaStore;
};

function getDefaultRunStageDependencies(): RunStageDependencies {
  return {
    convex: getConvexWorkerClient(),
    runOpenAiChat,
    quota: getQuotaStore(),
  };
}

function buildObservedDimensions(result: Awaited<ReturnType<typeof runOpenAiChat>>) {
  return {
    requests: 1,
    input_tokens: result.input_tokens ?? undefined,
    output_tokens: result.output_tokens ?? undefined,
    total_tokens: result.total_tokens ?? undefined,
  };
}

export async function runRunStageActivityWithDeps(
  deps: RunStageDependencies,
  runId: string,
  stage: RunStageKey,
): Promise<StageActivityResult<RunStageKey>> {
  const { convex } = deps;
  const run = await convex.getRunExecutionContext(runId);
  const inputs = await convex.listRunStageInputs({
    run_id: runId,
    stage,
  });

  let successCount = 0;
  let failureCount = 0;

  for (const input of inputs) {
    const taskResult = await processRunStageInputWithRetries(deps, {
      runId,
      stage,
      input,
      workflowId: run.workflow_id ?? `run:${runId}`,
    });

    if (taskResult === "succeeded") {
      successCount += 1;
    } else {
      failureCount += 1;
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
    input: {
      target_type: "sample" | "sample_score_target";
      target_id: string;
      model: string;
      system_prompt: string;
      user_prompt: string;
      metadata_json: string | null;
    };
  },
): Promise<"succeeded" | "failed"> {
  const { provider } = getModelConfig(args.input.model);
  let maxAttempts = RETRY_SETTINGS.unexpectedFailureMaxAttempts;
  let attempt = 0;
  let lastFailure:
    | {
        attemptId: string;
        message: string;
      }
    | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;

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
      input_tokens:
        estimateTextTokens(args.input.system_prompt)
        + estimateTextTokens(args.input.user_prompt),
      total_tokens:
        estimateTextTokens(args.input.system_prompt)
        + estimateTextTokens(args.input.user_prompt),
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
      return "succeeded";
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
      lastFailure = {
        attemptId: attempt_id,
        message,
      };
      const failureClass = classifyTaskFailure(error);
      maxAttempts = resolveAttemptLimitForFailureClass(
        failureClass,
        RETRY_SETTINGS,
      );
      if (attempt < maxAttempts) {
        await sleep(RETRY_SETTINGS.backoffMs);
        continue;
      }
    }
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

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}
