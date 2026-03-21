import type {
  RunStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import { estimateTextTokens, getQuotaStore, type QuotaStore } from "../quota";
import { getModelConfig } from "../window/model_registry";
import { runOpenAiChat } from "../window/service";

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
    const { provider } = getModelConfig(input.model);
    const workflowId = run.workflow_id ?? `run:${runId}`;
    const { attempt_id } = await convex.recordLlmAttemptStart({
      process_kind: "run",
      process_id: runId,
      target_type: input.target_type,
      target_id: input.target_id,
      stage,
      provider,
      model: input.model,
      operation_type: "chat",
      workflow_id: workflowId,
      system_prompt: input.system_prompt,
      user_prompt: input.user_prompt,
      metadata_json: input.metadata_json,
    });
    const reservedDimensions = {
      requests: 1,
      input_tokens:
        estimateTextTokens(input.system_prompt) + estimateTextTokens(input.user_prompt),
      total_tokens:
        estimateTextTokens(input.system_prompt) + estimateTextTokens(input.user_prompt),
    };
    const reservation = await deps.quota.reserve({
      reservationId: `run:${runId}:${stage}:${input.target_id}:${attempt_id}`,
      provider,
      model: input.model,
      operationType: "chat",
      scopeKey: `run:${runId}:${stage}`,
      dimensions: reservedDimensions,
      processKind: "run",
      processId: runId,
      workflowId,
    });

    try {
      if (!reservation.allowed) {
        throw new Error(
          `Quota reservation denied for ${stage}: ${reservation.reason ?? "quota_denied"}`,
        );
      }

      const result = await deps.runOpenAiChat({
        model: input.model,
        systemPrompt: input.system_prompt,
        userPrompt: input.user_prompt,
      });
      await convex.recordLlmAttemptFinish({
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
        model: input.model,
        operationType: "chat",
        scopeKey: `run:${runId}:${stage}`,
        reserved: reservedDimensions,
        observed: buildObservedDimensions(result),
        status: "applied",
      });
      await convex.applyRunStageResult({
        run_id: runId,
        target_id: input.target_id,
        stage,
        attempt_id,
        output: result.assistant_output,
      });
      successCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (reservation.allowed) {
        await deps.quota.settle({
          reservationId: reservation.reservationId,
          provider,
          model: input.model,
          operationType: "chat",
          scopeKey: `run:${runId}:${stage}`,
          reserved: reservedDimensions,
          observed: { requests: 1 },
          status: "failed",
        });
      }
      await convex.recordLlmAttemptFinish({
        attempt_id,
        status: "failed",
        error_message: message,
      });
      await convex.markRunStageFailure({
        run_id: runId,
        target_id: input.target_id,
        stage,
        attempt_id,
        error_message: message,
      });
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
