import type {
  EvidenceTransformStageKey,
  StageActivityResult,
} from "@judge-gym/engine-settings/process";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import { runModelChat } from "../llm/client";

type EvidenceTransformStageDependencies = {
  convex: Pick<
    ConvexWorkerClient,
    | "getEvidenceTransformRunExecutionContext"
    | "markEvidenceTransformStageRunning"
    | "listEvidenceTransformStageInputs"
    | "applyEvidenceTransformStageResult"
    | "markEvidenceTransformStageFailure"
    | "finalizeEvidenceTransformStage"
    | "markEvidenceTransformRunError"
  >;
  runModelChat: typeof runModelChat;
};

function getDefaultDependencies(): EvidenceTransformStageDependencies {
  return {
    convex: getConvexWorkerClient(),
    runModelChat,
  };
}

function summarizeStage(args: {
  stage: EvidenceTransformStageKey;
  completed: number;
  failed: number;
  total: number;
}) {
  return `${args.stage} completed ${args.completed}/${args.total} with ${args.failed} failed`;
}

export async function runEvidenceTransformStageActivity(
  evidenceTransformRunId: string,
  stage: EvidenceTransformStageKey,
  deps = getDefaultDependencies(),
): Promise<StageActivityResult<EvidenceTransformStageKey>> {
  await deps.convex.getEvidenceTransformRunExecutionContext(evidenceTransformRunId);
  await deps.convex.markEvidenceTransformStageRunning({
    evidence_transform_run_id: evidenceTransformRunId,
    stage,
  });

  try {
    const inputs = await deps.convex.listEvidenceTransformStageInputs({
      evidence_transform_run_id: evidenceTransformRunId,
      stage,
    });

    for (const input of inputs) {
      try {
        const result = await deps.runModelChat({
          model: input.model,
          systemPrompt: input.system_prompt,
          userPrompt: input.user_prompt,
        });
        await deps.convex.applyEvidenceTransformStageResult({
          evidence_transform_run_id: evidenceTransformRunId,
          evidence_item_id: input.evidence_item_id,
          stage,
          output: result.assistant_output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await deps.convex.markEvidenceTransformStageFailure({
          evidence_transform_run_id: evidenceTransformRunId,
          evidence_item_id: input.evidence_item_id,
          stage,
          error_message: message,
        });
      }
    }

    const finalized = await deps.convex.finalizeEvidenceTransformStage({
      evidence_transform_run_id: evidenceTransformRunId,
      stage,
    });

    return {
      processKind: "run",
      processId: evidenceTransformRunId,
      stage,
      summary: summarizeStage({
        stage,
        completed: finalized.completed,
        failed: finalized.failed,
        total: finalized.total,
      }),
      haltProcess: finalized.halt_process,
      errorMessage: finalized.error_message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.convex.markEvidenceTransformRunError({
      evidence_transform_run_id: evidenceTransformRunId,
      stage,
      error_message: message,
    });
    return {
      processKind: "run",
      processId: evidenceTransformRunId,
      stage,
      summary: `${stage} failed`,
      haltProcess: true,
      errorMessage: message,
    };
  }
}
